/**
 * Service worker: owns the WebSocket to the daemon, screenshot capture, and
 * the persisted list of pending feedback items.
 */
import type {
  ActiveSessionInfo,
  DaemonToExt,
  ExtToDaemon,
  FeedbackItem,
  SubmitResult,
} from "@nitpic/shared";

interface Settings {
  port: number;
  token: string;
  screenshotDefault: boolean;
}

/** A feedback item plus extension-side bookkeeping. */
export interface PendingItem extends FeedbackItem {
  status: "pending";
}

const DEFAULT_SETTINGS: Settings = { port: 8790, token: "", screenshotDefault: true };

async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
}

async function getItems(): Promise<PendingItem[]> {
  const { items } = await chrome.storage.local.get("items");
  return Array.isArray(items) ? items : [];
}

async function setItems(items: PendingItem[]): Promise<void> {
  await chrome.storage.local.set({ items });
}

/* ------------------------------------------------------------------ */
/* WebSocket connection to the daemon                                  */
/* ------------------------------------------------------------------ */

type ConnState = "disconnected" | "connecting" | "connected";
let ws: WebSocket | null = null;
let connState: ConnState = "disconnected";
let lastError = "";
let helloWaiters: Array<(ok: boolean) => void> = [];
const pendingRequests = new Map<string, (msg: DaemonToExt) => void>();
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

/** Latest active-session state pushed by the daemon. */
let session: ActiveSessionInfo | null = null;

async function setSession(next: ActiveSessionInfo | null): Promise<void> {
  session = next;
  // Mirror into storage so the side panel re-renders reactively.
  await chrome.storage.local.set({ session: next });
}

function reqId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function connect(): Promise<boolean> {
  if (connState === "connected") return true;
  if (connState === "connecting") {
    return new Promise((resolve) => helloWaiters.push(resolve));
  }
  const settings = await getSettings();
  if (!settings.token) {
    lastError = "Not paired yet — type /nitpic in Claude Code to get the pairing token.";
    return false;
  }
  connState = "connecting";
  return new Promise((resolve) => {
    helloWaiters.push(resolve);
    let socket: WebSocket;
    try {
      socket = new WebSocket(`ws://127.0.0.1:${settings.port}`);
    } catch (err) {
      failHello(`Bad daemon address: ${String(err)}`);
      return;
    }
    ws = socket;
    const connectTimeout = setTimeout(() => {
      failHello("Daemon not responding");
      socket.close();
    }, 3000);

    socket.onopen = () => {
      send({ type: "hello", token: settings.token });
    };
    socket.onmessage = (ev) => {
      let msg: DaemonToExt;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.type === "hello-ok") {
        clearTimeout(connectTimeout);
        connState = "connected";
        lastError = "";
        // Ping keeps the connection verified and the service worker alive.
        keepaliveTimer = setInterval(() => send({ type: "ping" }), 20000);
        flushHello(true);
        return;
      }
      if (msg.type === "hello-error") {
        clearTimeout(connectTimeout);
        failHello("Pairing token rejected by daemon — re-run /nitpic and re-pair in Settings.");
        return;
      }
      if (msg.type === "state") {
        void setSession(msg.session);
        return;
      }
      if ("requestId" in msg && msg.requestId) {
        const cb = pendingRequests.get(msg.requestId);
        if (cb) {
          pendingRequests.delete(msg.requestId);
          cb(msg);
        }
      }
    };
    socket.onclose = () => {
      if (connState === "connecting") failHello("Daemon not running");
      connState = "disconnected";
      ws = null;
      void setSession(null);
      if (keepaliveTimer) clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    };
    socket.onerror = () => {
      /* onclose follows and reports */
    };
  });

  function failHello(message: string) {
    lastError = message;
    connState = "disconnected";
    flushHello(false);
  }
  function flushHello(ok: boolean) {
    const waiters = helloWaiters;
    helloWaiters = [];
    for (const w of waiters) w(ok);
  }
}

function send(msg: ExtToDaemon): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

/** Send a request and await the matching response by requestId. */
async function request<T extends DaemonToExt>(
  build: (requestId: string) => ExtToDaemon,
  timeoutMs = 8000,
): Promise<T> {
  const ok = await connect();
  if (!ok) throw new Error(lastError || "not connected");
  const id = reqId();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error("daemon request timed out"));
    }, timeoutMs);
    pendingRequests.set(id, (msg) => {
      clearTimeout(timer);
      if (msg.type === "error") reject(new Error(msg.message));
      else resolve(msg as T);
    });
    send(build(id));
  });
}

// Periodic reconnect attempt so status recovers after a daemon restart.
chrome.alarms.create("nitpic-reconnect", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "nitpic-reconnect" && connState === "disconnected") {
    void connect();
  }
});

/* ------------------------------------------------------------------ */
/* Screenshot capture + crop                                           */
/* ------------------------------------------------------------------ */

async function captureAndCrop(
  windowId: number,
  rect: { x: number; y: number; width: number; height: number },
  dpr: number,
): Promise<string> {
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);

  const sx = Math.max(0, Math.round(rect.x * dpr));
  const sy = Math.max(0, Math.round(rect.y * dpr));
  const sw = Math.min(bmp.width - sx, Math.max(1, Math.round(rect.width * dpr)));
  const sh = Math.min(bmp.height - sy, Math.max(1, Math.round(rect.height * dpr)));
  if (sw <= 0 || sh <= 0) throw new Error("selection outside visible area");

  // Cap the long edge at 1568px — Claude's API downscales anything larger
  // anyway, and oversized retina captures can fail to process entirely.
  const MAX_EDGE = 1568;
  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const ow = Math.max(1, Math.round(sw * scale));
  const oh = Math.max(1, Math.round(sh * scale));

  const canvas = new OffscreenCanvas(ow, oh);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, ow, oh);
  const out = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(out);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return "data:image/png;base64," + btoa(binary);
}

/* ------------------------------------------------------------------ */
/* Message handling                                                    */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === "offscreen") return; // let the offscreen document answer
  handleMessage(msg, sender)
    .then(sendResponse)
    .catch((err: unknown) =>
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
  return true; // async response
});

async function handleMessage(
  msg: any,
  sender: chrome.runtime.MessageSender,
): Promise<any> {
  switch (msg.cmd) {
    case "get-status": {
      const settings = await getSettings();
      if (connState === "disconnected") await connect();
      return {
        ok: true,
        connected: connState === "connected",
        error: lastError,
        port: settings.port,
        tokenSet: Boolean(settings.token),
        screenshotDefault: settings.screenshotDefault,
        session,
      };
    }

    case "capture-item": {
      // From the content script: item lacks screenshot; we capture if asked.
      const item: PendingItem = { ...msg.item, status: "pending" };
      if (msg.wantScreenshot && sender.tab?.windowId !== undefined) {
        try {
          item.screenshot = await captureAndCrop(sender.tab.windowId, item.rect, msg.dpr || 1);
        } catch {
          item.screenshotFailed = true;
        }
      }
      const items = await getItems();
      items.push(item);
      await setItems(items);
      return { ok: true, count: items.length, screenshotFailed: !!item.screenshotFailed };
    }

    case "update-item": {
      const items = await getItems();
      const found = items.find((i) => i.id === msg.id);
      if (found) found.comment = msg.comment;
      await setItems(items);
      return { ok: true };
    }

    case "delete-item": {
      await setItems((await getItems()).filter((i) => i.id !== msg.id));
      return { ok: true };
    }

    case "send-items": {
      const all = await getItems();
      const toSend = msg.ids ? all.filter((i) => msg.ids.includes(i.id)) : all;
      if (toSend.length === 0) return { ok: true, result: null };

      const items: FeedbackItem[] = toSend.map(({ status, ...item }) => item);
      const res = await request<{
        type: "submit-result";
        requestId: string;
        result: SubmitResult;
      }>((requestId) => ({ type: "submit", requestId, items }));

      // Delivered/queued items leave the panel; "no-session" items stay.
      if (res.result.status !== "no-session") {
        const done = new Set(res.result.itemIds);
        await setItems(all.filter((i) => !done.has(i.id)));
      }
      return { ok: true, result: res.result };
    }

    case "auto-pair":
      return { ok: true, ...(await autoPair()) };

    case "open-welcome":
      await chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
      return { ok: true };

    case "toggle-mode": {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab?.id === undefined) return { ok: false, error: "no active tab" };
      try {
        const res = await chrome.tabs.sendMessage(tab.id, { cmd: "toggle-mode" });
        return { ok: true, active: res?.active };
      } catch {
        // No content script yet — the hotkey is a user gesture, so activeTab lets
        // us inject on the spot and retry, no page refresh needed.
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
          const res = await chrome.tabs.sendMessage(tab.id, { cmd: "toggle-mode" });
          return { ok: true, active: res?.active };
        } catch {
          return { ok: false, error: "This page can't be annotated (try reloading it)." };
        }
      }
    }

    default:
      return { ok: false, error: `unknown cmd: ${msg.cmd}` };
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-feedback-mode") {
    void handleMessage({ cmd: "toggle-mode" }, {} as chrome.runtime.MessageSender);
  }
});

// The toolbar icon toggles the floating on-page panel for that tab only —
// it overlays the page instead of squeezing the viewport like a side panel.
// If the page predates the extension (no content script yet), inject it on
// the spot so the first click always works — no refresh needed.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { cmd: "toggle-widget" });
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, { cmd: "toggle-widget" });
    } catch {
      // chrome:// pages, the Web Store, etc. — nothing to annotate there.
    }
  }
});

// Greet brand-new installs with the setup guide. (Under activeTab there's no
// broad host access to pre-inject open tabs — the content script loads the
// first time you click the toolbar icon or hit the hotkey on a page.)
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    void chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});

/* ------------------------------------------------------------------ */
/* Clipboard auto-pairing (via offscreen document)                     */
/* ------------------------------------------------------------------ */

// Silent clipboard reads are only allowed in extension-owned documents, so
// the floating panel asks us, and we read via a throwaway offscreen page.
const TOKEN_SHAPE = /^[0-9a-f]{32}$/;
let lastClipboardToken = "";

async function readClipboardViaOffscreen(): Promise<string> {
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.CLIPBOARD],
      justification: "Read the nitpic pairing code that /nitpic copied",
    });
  } catch {
    // already open
  }
  try {
    const res = await chrome.runtime.sendMessage({ target: "offscreen", cmd: "read-clipboard" });
    return typeof res?.text === "string" ? res.text : "";
  } finally {
    void chrome.offscreen.closeDocument().catch(() => {});
  }
}

async function autoPair(): Promise<{ paired: boolean }> {
  if (connState === "connected") return { paired: true };
  const text = (await readClipboardViaOffscreen()).trim();
  if (!TOKEN_SHAPE.test(text) || text === lastClipboardToken) return { paired: false };
  lastClipboardToken = text;
  const settings = await getSettings();
  await chrome.storage.local.set({ settings: { ...settings, token: text } });
  const ok = await connect();
  return { paired: ok };
}

// Connect eagerly so the panel shows live status right away.
void connect();
