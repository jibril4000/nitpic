/**
 * Floating feedback panel — lives on the page (inside the content script's
 * shadow root) instead of Chrome's side panel, so it never squeezes the
 * viewport or triggers responsive breakpoints. Draggable, collapsible to a
 * bubble, and hidden automatically during screenshot capture along with the
 * rest of the overlay UI.
 */

interface PanelItem {
  id: string;
  kind: "element" | "region";
  url: string;
  comment: string;
  selector?: string;
  screenshot?: string;
  status: "pending";
}

interface SessionInfo {
  projectPath: string;
  displayName: string;
  delivery: "instant" | "next-turn";
}

import mascotSvg from "./mascot.svg";
import logoSvg from "./logo.svg";
import cursorSvg from "./cursor.svg";

interface WidgetHooks {
  /** Toggle feedback mode on the page; returns the new state. */
  toggleMode(): boolean;
  getMode(): boolean;
}

const WIDTH = 316;
const MARGIN = 20;

// Attribution — update these once, they flow everywhere.
const AUTHOR_NAME = "Jibril";
const AUTHOR_URL = "https://linkedin.com/in/jibril-ai";
const COFFEE_URL = "https://buymeacoffee.com/jibrilai";

const CSS = `
  .w-root {
    position: fixed; z-index: 2147483647; width: ${WIDTH}px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased; letter-spacing: -0.01em;
    font-size: 13px; color: var(--n-text);
    pointer-events: auto;
    /* Claude-style warm grey backdrop; nitpic green + orange brand accents. */
    --n-bg: rgba(246, 245, 240, 0.94);
    --n-surface: #ffffff;
    --n-surface-2: #f1f0e9;
    --n-text: #1f1e1a;
    --n-text-2: #5f5d54;
    --n-text-3: #8f8d82;
    --n-accent: #91c31c;
    --n-accent-deep: #5d7f04;
    --n-on-accent: #1a2404;
    --n-orange: #fb933d;
    --n-orange-deep: #a85410;
    --n-ok: #6faa08;
    --n-warn: #fb933d;
    --n-bad: #e5484d;
    --n-card-shadow: 0 0 0 1px rgba(31,30,26,0.05), 0 1px 2px rgba(31,30,26,0.05), 0 10px 28px -14px rgba(43,40,30,0.18);
    --n-img-outline: rgba(0, 0, 0, 0.1);
    --n-hairline: rgba(31, 30, 26, 0.08);
    --n-ease: cubic-bezier(0.2, 0, 0, 1);
  }
  @media (prefers-color-scheme: dark) {
    .w-root {
      --n-bg: rgba(41, 40, 36, 0.94);
      --n-surface: #34332d;
      --n-surface-2: #3e3d36;
      --n-text: #f2f1ea;
      --n-text-2: #b7b5a9;
      --n-text-3: #868478;
      --n-accent: #9cd028;
      --n-accent-deep: #b8e35a;
      --n-orange-deep: #ffb26b;
      --n-ok: #9cd028;
      --n-card-shadow: 0 0 0 1px rgba(255,255,255,0.07), 0 1px 2px rgba(0,0,0,0.35), 0 10px 28px -14px rgba(0,0,0,0.55);
      --n-img-outline: rgba(255, 255, 255, 0.1);
      --n-hairline: rgba(255, 255, 255, 0.09);
    }
  }
  .panel {
    display: flex; flex-direction: column; overflow: hidden;
    max-height: min(76vh, 620px);
    border-radius: 24px;
    background: var(--n-bg);
    -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%);
    box-shadow: 0 0 0 1px var(--n-hairline), 0 2px 8px rgba(20,10,60,0.10), 0 24px 64px -16px rgba(20,10,60,0.38);
    opacity: 1; transform: none; transform-origin: top right;
    transition-property: opacity, transform; transition-duration: 0.22s; transition-timing-function: var(--n-ease);
  }
  .panel.hidden { opacity: 0; transform: scale(0.96) translateY(6px); pointer-events: none; }

  /* ---------- header ---------- */
  .w-header { padding: 14px 14px 0; cursor: grab; user-select: none; flex: none; }
  .w-header:active { cursor: grabbing; }
  .brand-row { display: flex; align-items: center; gap: 8px; }
  /* The real logo, theme-aware: "nit" and the cursor follow the text color. */
  svg.logo { height: 17px; width: auto; display: block; overflow: visible; }
  svg.logo .hl { fill: var(--n-accent); }
  svg.logo .pic { fill: #fff; }
  svg.logo .nit { fill: var(--n-text); }
  .w-root .cursor { fill: var(--n-text); }
  svg.cursor-art { width: 40px; height: auto; display: block; margin: 0 auto 10px; }
  .spacer { flex: 1; }
  .chip {
    display: inline-flex; align-items: center; gap: 5px; max-width: 140px;
    border-radius: 100px; padding: 4px 9px;
    font-size: 11px; font-weight: 600; color: var(--n-text-2);
    background: color-mix(in srgb, var(--n-text) 6%, transparent);
  }
  .chip .txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--n-bad); flex: none; transition: background-color 0.3s; }
  .dot.ok { background: var(--n-ok); }
  .dot.warn { background: var(--n-warn); }
  .w-btn {
    appearance: none; border: 0; cursor: pointer; font: inherit; font-weight: 600; position: relative;
    transition-property: transform, background-color, color, box-shadow, opacity;
    transition-duration: 0.2s; transition-timing-function: var(--n-ease);
  }
  .w-btn:active { transform: scale(0.96); }
  .collapse {
    flex: none; width: 24px; height: 24px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: transparent; color: var(--n-text-3);
  }
  .collapse:hover { background: color-mix(in srgb, var(--n-text) 7%, transparent); color: var(--n-text-2); }
  .collapse::after { content: ""; position: absolute; inset: -8px; border-radius: 50%; }
  .collapse svg { display: block; }
  .subline {
    font-size: 11px; color: var(--n-text-3); margin: 6px 2px 0; min-height: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .subline:empty { display: none; }
  .controls { display: flex; gap: 8px; padding: 10px 0 12px; }
  .btn {
    flex: 1; min-height: 38px; padding: 0 12px; border-radius: 100px; font-size: 12.5px;
    white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .btn.primary {
    background: var(--n-accent); color: var(--n-on-accent);
    box-shadow: 0 1px 2px rgba(0,0,0,0.12), 0 6px 16px -6px color-mix(in srgb, var(--n-accent) 55%, transparent);
  }
  .btn.quiet { background: color-mix(in srgb, var(--n-text) 7%, transparent); color: var(--n-text); }
  .btn.stop { background: color-mix(in srgb, var(--n-orange) 22%, transparent); color: var(--n-orange-deep); box-shadow: none; }
  .btn:disabled {
    pointer-events: none; box-shadow: none;
    background: color-mix(in srgb, var(--n-text) 4%, transparent); color: var(--n-text-3);
  }

  /* ---------- body ---------- */
  .body { overflow-y: auto; overscroll-behavior: contain; padding: 0 14px 14px; }
  .section { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; transition: opacity 0.2s; }
  .section.leaving { opacity: 0; }
  .section-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--n-text-3); margin: 0 4px -2px; word-break: break-all;
  }
  .item {
    background: var(--n-surface); border-radius: 16px; padding: 9px;
    box-shadow: var(--n-card-shadow);
    transition-property: opacity, transform; transition-duration: 0.24s; transition-timing-function: var(--n-ease);
  }
  .item.pre { opacity: 0; transform: translateY(10px) scale(0.98); }
  .item.leaving { opacity: 0; transform: translateY(-6px) scale(0.98); }
  .item img {
    display: block; width: 100%; max-height: 110px; object-fit: cover;
    border-radius: 7px; outline: 1px solid var(--n-img-outline); outline-offset: -1px; margin-bottom: 7px;
  }
  .item .sel { font-family: ui-monospace, monospace; font-size: 10.5px; color: var(--n-accent-deep); word-break: break-all; margin: 0 2px 6px; }
  .item textarea {
    width: 100%; min-height: 40px; resize: vertical; font: inherit; font-size: 12px; box-sizing: border-box;
    border: 0; border-radius: 7px; padding: 7px 8px; outline: none;
    color: var(--n-text); background: color-mix(in srgb, var(--n-text) 5%, transparent);
    box-shadow: 0 0 0 2px transparent;
    transition-property: box-shadow, background-color; transition-duration: 0.18s;
  }
  .item textarea:focus { box-shadow: 0 0 0 2px color-mix(in srgb, var(--n-accent) 45%, transparent); background: var(--n-surface-2); }
  .item .row { display: flex; gap: 6px; margin-top: 7px; justify-content: flex-end; }
  .mini { min-height: 30px; padding: 0 12px; border-radius: 100px; font-size: 11.5px; }
  .mini.tinted { background: color-mix(in srgb, var(--n-accent) 18%, transparent); color: var(--n-accent-deep); }
  .mini.ghost { background: transparent; color: var(--n-text-3); }
  .mini.ghost:hover { color: var(--n-bad); background: color-mix(in srgb, var(--n-bad) 8%, transparent); }
  .empty { text-align: center; color: var(--n-text); padding: 18px 20px 12px; font-size: 15px; line-height: 1.4; letter-spacing: -0.02em; text-wrap: pretty; }
  .foot {
    flex: none; display: flex; justify-content: center; gap: 5px;
    padding: 7px 14px 11px; font-size: 10.5px; color: var(--n-text-3);
  }
  .foot a { color: inherit; text-decoration: none; transition-property: color; transition-duration: 0.15s; }
  .foot a:hover { color: var(--n-text-2); }

  /* ---------- pairing (onboarding) state ---------- */
  .pair { display: none; padding: 6px 18px 18px; text-align: center; }
  .panel.pairing .pair { display: block; }
  .panel.pairing .controls, .panel.pairing .body, .panel.pairing .chip { display: none; }
  .mascot { margin: 8px auto 10px; }
  .mascot svg { width: 100%; height: auto; display: block; }
  .pair svg.cursor-art { width: 52px; margin: 12px auto 14px; animation: bob 3.2s var(--n-ease) infinite alternate; }
  @keyframes bob { from { transform: translateY(0); } to { transform: translateY(-4px); } }
  .empty .mascot { width: 64px; opacity: 0.95; }
  .pair h2 { font-size: 15px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.02em; }
  .pair p { font-size: 12px; color: var(--n-text-2); margin: 0 0 2px; text-wrap: pretty; line-height: 1.45; }
  .pair p b { color: var(--n-text); font-family: ui-monospace, monospace; font-weight: 600; }
  .waiting {
    display: inline-flex; align-items: center; gap: 7px; margin-top: 12px;
    font-size: 11.5px; font-weight: 600; color: var(--n-text-3);
  }
  .waiting .beads { display: inline-flex; gap: 3px; }
  .waiting .beads i {
    width: 4px; height: 4px; border-radius: 50%; background: var(--n-accent); display: block;
    animation: bead 1.2s var(--n-ease) infinite;
  }
  .waiting .beads i:nth-child(2) { animation-delay: 0.15s; }
  .waiting .beads i:nth-child(3) { animation-delay: 0.3s; }
  @keyframes bead { 0%, 100% { opacity: 0.25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }
  .manual-link {
    display: inline-block; margin-top: 12px; background: none; padding: 4px;
    font-size: 11px; font-weight: 600; color: var(--n-text-3); text-decoration: underline;
    text-underline-offset: 2px; cursor: pointer; border: 0;
  }
  .manual-link:hover { color: var(--n-text-2); }
  .manual { display: none; margin-top: 8px; }
  .manual.show { display: block; }
  .manual input {
    width: 100%; font-size: 11.5px; padding: 9px 10px; border: 0; border-radius: 10px; box-sizing: border-box;
    background: color-mix(in srgb, var(--n-text) 6%, transparent); color: var(--n-text); outline: none;
    font-family: ui-monospace, monospace; text-align: center;
    box-shadow: 0 0 0 2px transparent;
    transition-property: box-shadow; transition-duration: 0.18s;
  }
  .manual input:focus { box-shadow: 0 0 0 2px color-mix(in srgb, var(--n-accent) 45%, transparent); }

  /* ---------- bubble ---------- */
  .bubble {
    position: absolute; inset: 0; width: 116px; height: 52px; border-radius: 100px;
    background: var(--n-bg);
    -webkit-backdrop-filter: blur(16px) saturate(180%); backdrop-filter: blur(16px) saturate(180%);
    display: flex; align-items: center; justify-content: center; cursor: grab;
    box-sizing: border-box;
    box-shadow: 0 0 0 1px var(--n-hairline), 0 2px 6px rgba(31,30,26,0.18), 0 12px 32px -8px rgba(31,30,26,0.35);
    opacity: 0; transform: scale(0.25); pointer-events: none; user-select: none;
    transition-property: opacity, transform; transition-duration: 0.22s; transition-timing-function: var(--n-ease);
  }
  .bubble svg.logo { height: 22px; pointer-events: none; }
  .bubble.show { opacity: 1; transform: scale(1); pointer-events: auto; }
  .bubble:active { cursor: grabbing; }
  .bubble .badge {
    position: absolute; top: -3px; right: -3px; min-width: 18px; height: 18px; border-radius: 100px;
    background: var(--n-orange); color: #3c1e02; font-size: 10.5px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; padding: 0 5px; box-sizing: border-box;
    font-variant-numeric: tabular-nums;
    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    opacity: 0; transform: scale(0.25);
    transition-property: opacity, transform; transition-duration: 0.2s; transition-timing-function: var(--n-ease);
  }
  .bubble .badge.show { opacity: 1; transform: scale(1); }
  @media (prefers-reduced-motion: reduce) {
    .panel, .bubble, .item, .section, .badge { transition-duration: 0.01ms !important; }
    .waiting .beads i, .pair svg.cursor-art { animation: none; }
  }
`;

const COLLAPSE_ICON = `<svg width="10" height="2" viewBox="0 0 10 2" fill="none"><rect width="10" height="2" rx="1" fill="currentColor"/></svg>`;

export function createWidget(shadow: ShadowRoot, hooks: WidgetHooks) {
  const style = document.createElement("style");
  style.textContent = CSS;
  shadow.append(style);

  const root = document.createElement("div");
  root.className = "w-root";
  root.style.display = "none";
  root.innerHTML = `
    <div class="panel hidden">
      <div class="w-header" data-drag>
        <div class="brand-row">
          ${logoSvg}
          <div class="spacer"></div>
          <div class="chip"><span class="dot"></span><span class="txt">…</span></div>
          <button class="w-btn collapse" title="Collapse">${COLLAPSE_ICON}</button>
        </div>
        <div class="subline"></div>
        <div class="controls">
          <button class="w-btn btn primary mode">Start feedback</button>
          <button class="w-btn btn quiet send-all" disabled>Send all</button>
        </div>
      </div>
      <div class="pair">
        ${cursorSvg}
        <h2>Connect to Claude Code</h2>
        <p>Type <b>/nitpic</b> in your Claude Code session.</p>
        <p>Pairing finishes here by itself — nothing to copy.</p>
        <div class="waiting"><span class="beads"><i></i><i></i><i></i></span> waiting for /nitpic</div>
        <div>
          <button class="w-btn manual-link setup-link">full setup guide</button>
          <button class="w-btn manual-link">enter code manually</button>
          <div class="manual"><input class="pair-token" placeholder="pairing code" /></div>
        </div>
      </div>
      <div class="body">
        <div class="groups"></div>
        <div class="empty">
          <div class="mascot">${mascotSvg}</div>
          Click <b>Start feedback</b>, then click anything on the page.
        </div>
      </div>
      <div class="foot">
        <a href="${AUTHOR_URL}" target="_blank" rel="noreferrer">made by ${AUTHOR_NAME}</a>
        <span>·</span>
        <a href="${COFFEE_URL}" target="_blank" rel="noreferrer">☕ buy me a coffee</a>
      </div>
    </div>
    <div class="bubble" data-drag>${logoSvg}<span class="badge"></span></div>
  `;
  shadow.append(root);

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const panel = $(".panel");
  const bubble = $(".bubble");
  const badge = $(".badge");
  const dot = $(".dot");
  const chipTxt = $(".chip .txt");
  const subline = $(".subline");
  const modeBtn = $(".mode") as HTMLButtonElement;
  const sendAllBtn = $(".send-all") as HTMLButtonElement;
  const groupsDiv = $(".groups");
  const emptyDiv = $(".empty");

  let open = false;
  let collapsed = false;
  let itemCount = 0;
  let pairing = false;
  let statusTimer: ReturnType<typeof setInterval> | null = null;

  async function bg(msg: object): Promise<any> {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  /* ---------- position + dragging ---------- */

  function defaultPos() {
    return { x: window.innerWidth - WIDTH - MARGIN, y: MARGIN };
  }

  function clamp(x: number, y: number) {
    const w = collapsed ? 116 : WIDTH;
    const h = collapsed ? 52 : 120; // keep at least the header reachable
    return {
      x: Math.min(Math.max(8, x), window.innerWidth - w - 8),
      y: Math.min(Math.max(8, y), window.innerHeight - h),
    };
  }

  let pos = defaultPos();

  function applyPos() {
    const p = clamp(pos.x, pos.y);
    root.style.left = `${p.x}px`;
    root.style.top = `${p.y}px`;
  }

  async function loadState() {
    const { widget } = await chrome.storage.local.get("widget");
    if (widget && typeof widget.x === "number") pos = { x: widget.x, y: widget.y };
    collapsed = Boolean(widget?.collapsed);
  }

  function saveState() {
    void chrome.storage.local.set({ widget: { ...pos, collapsed } });
  }

  let dragMoved = false;
  root.addEventListener("pointerdown", (ev) => {
    const target = ev.target as HTMLElement;
    if (!target.closest("[data-drag]") || target.closest("button, input, textarea")) return;
    ev.preventDefault();
    dragMoved = false;
    const startX = ev.clientX - pos.x;
    const startY = ev.clientY - pos.y;
    const move = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - startX - pos.x, e.clientY - startY - pos.y) > 4) dragMoved = true;
      pos = { x: e.clientX - startX, y: e.clientY - startY };
      applyPos();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      pos = clamp(pos.x, pos.y);
      saveState();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
  window.addEventListener("resize", applyPos);

  /* ---------- collapse / expand ---------- */

  function setCollapsed(next: boolean) {
    collapsed = next;
    panel.classList.toggle("hidden", collapsed);
    bubble.classList.toggle("show", collapsed);
    applyPos();
    saveState();
    if (!collapsed) void refreshStatus();
  }

  $(".collapse").addEventListener("click", () => setCollapsed(true));
  bubble.addEventListener("click", () => {
    if (!dragMoved) setCollapsed(false);
  });

  /* ---------- status ---------- */

  function setChip(state: "ok" | "warn" | "bad", text: string, sub = "") {
    dot.className = "dot" + (state === "ok" ? " ok" : state === "warn" ? " warn" : "");
    chipTxt.textContent = text;
    subline.textContent = sub;
  }

  function setPairing(on: boolean) {
    if (pairing === on) return;
    pairing = on;
    panel.classList.toggle("pairing", on);
    if (statusTimer) clearInterval(statusTimer);
    // Poll faster while waiting for /nitpic so pairing feels instant.
    statusTimer = setInterval(() => void refreshStatus(), on ? 2000 : 5000);
  }

  async function refreshStatus() {
    if (!open || collapsed) return;
    const s = await bg({ cmd: "get-status" });
    if (!s?.ok) return setChip("bad", "error");
    const needsPairing = !s.tokenSet || (!s.connected && /token|pair/i.test(s.error ?? ""));
    setPairing(needsPairing);
    if (needsPairing) {
      const r = await bg({ cmd: "auto-pair" });
      if (r?.paired) {
        toastFn("Paired ✓ — you're all set.");
        setPairing(false);
        void refreshStatus();
      }
      return;
    }
    if (!s.connected) return setChip("bad", "offline", "Type /nitpic in Claude Code to reconnect.");
    const session: SessionInfo | null = s.session ?? null;
    if (session) {
      setChip(
        "ok",
        session.displayName,
        session.delivery === "next-turn" ? "Delivers when Claude finishes its current turn." : "",
      );
    } else {
      setChip("warn", "no session", "Type /nitpic in the Claude Code session that should listen.");
    }
  }

  $(".setup-link").addEventListener("click", () => void bg({ cmd: "open-welcome" }));

  $(".manual-link:not(.setup-link)").addEventListener("click", () => {
    $(".manual").classList.toggle("show");
    ($(".pair-token") as HTMLInputElement).focus();
  });

  $(".pair-token").addEventListener("keydown", async (ev) => {
    if ((ev as KeyboardEvent).key !== "Enter") return;
    const token = ($(".pair-token") as HTMLInputElement).value.trim();
    if (!token) return;
    const { settings } = await chrome.storage.local.get("settings");
    await chrome.storage.local.set({
      settings: { port: 8790, screenshotDefault: true, ...(settings ?? {}), token },
    });
    const s = await bg({ cmd: "get-status" });
    toastFn(s?.connected ? "Paired ✓ — you're all set." : "That code didn't connect — run /nitpic first.");
    void refreshStatus();
  });

  /* ---------- items ---------- */

  const cards = new Map<string, HTMLElement>();
  const sections = new Map<string, HTMLElement>();

  function pageLabel(url: string): string {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }

  function getSection(url: string): HTMLElement {
    let sec = sections.get(url);
    if (!sec) {
      sec = document.createElement("div");
      sec.className = "section";
      const label = document.createElement("div");
      label.className = "section-label";
      label.textContent = pageLabel(url);
      sec.append(label);
      groupsDiv.append(sec);
      sections.set(url, sec);
    }
    return sec;
  }

  function pruneSection(url: string) {
    const sec = sections.get(url);
    if (sec && sec.querySelectorAll(".item:not(.leaving)").length === 0) {
      sections.delete(url);
      sec.classList.add("leaving");
      setTimeout(() => sec.remove(), 220);
    }
  }

  function buildCard(item: PanelItem): HTMLElement {
    const card = document.createElement("div");
    card.className = "item";
    card.dataset.url = item.url;
    if (item.screenshot) {
      const img = document.createElement("img");
      img.src = item.screenshot;
      card.append(img);
    }
    const sel = document.createElement("div");
    sel.className = "sel";
    sel.textContent =
      item.kind === "element" ? item.selector ?? "(element)" : `region · near ${item.selector ?? "?"}`;
    card.append(sel);
    const ta = document.createElement("textarea");
    ta.value = item.comment;
    ta.addEventListener("change", () => void bg({ cmd: "update-item", id: item.id, comment: ta.value }));
    card.append(ta);
    const row = document.createElement("div");
    row.className = "row";
    const del = document.createElement("button");
    del.className = "w-btn mini ghost";
    del.textContent = "Delete";
    del.addEventListener("click", () => void bg({ cmd: "delete-item", id: item.id }));
    const send = document.createElement("button");
    send.className = "w-btn mini tinted";
    send.textContent = "Send now";
    send.addEventListener("click", () => void sendItems([item.id]));
    row.append(del, send);
    card.append(row);
    return card;
  }

  function updateEmphasis() {
    const hasItems = itemCount > 0;
    sendAllBtn.disabled = !hasItems;
    sendAllBtn.textContent = hasItems ? `Send all (${itemCount})` : "Send all";
    sendAllBtn.classList.toggle("primary", hasItems);
    sendAllBtn.classList.toggle("quiet", !hasItems);
    const stopped = modeBtn.classList.contains("stop");
    modeBtn.classList.toggle("primary", !hasItems && !stopped);
    modeBtn.classList.toggle("quiet", hasItems && !stopped);
    badge.textContent = String(itemCount);
    badge.classList.toggle("show", hasItems);
  }

  function render(items: PanelItem[]) {
    itemCount = items.length;
    updateEmphasis();
    const ids = new Set(items.map((i) => i.id));
    for (const [id, el] of cards) {
      if (!ids.has(id)) {
        cards.delete(id);
        el.classList.add("leaving");
        const url = el.dataset.url ?? "";
        setTimeout(() => {
          el.remove();
          pruneSection(url);
        }, 260);
        pruneSection(url);
      }
    }
    for (const item of items) {
      const existing = cards.get(item.id);
      if (existing) {
        const ta = existing.querySelector("textarea")!;
        if (shadow.activeElement !== ta && ta.value !== item.comment) ta.value = item.comment;
        continue;
      }
      const card = buildCard(item);
      card.classList.add("pre");
      getSection(item.url).append(card);
      cards.set(item.id, card);
      requestAnimationFrame(() => requestAnimationFrame(() => card.classList.remove("pre")));
    }
    emptyDiv.style.display = items.length === 0 ? "block" : "none";
  }

  async function currentItems(): Promise<PanelItem[]> {
    const { items } = await chrome.storage.local.get("items");
    return Array.isArray(items) ? items : [];
  }

  /* ---------- sending ---------- */

  let toastFn: (text: string) => void = () => {};

  async function sendItems(ids?: string[]) {
    const res = await bg({ cmd: "send-items", ids });
    if (!res?.ok) return toastFn(`Send failed: ${res?.error ?? "unknown"} — comments kept.`);
    if (!res.result) return;
    switch (res.result.status) {
      case "delivered":
        toastFn("Sent to Claude ✓");
        break;
      case "queued":
        toastFn("Sent — Claude picks it up when it finishes its current response.");
        break;
      case "no-session":
        toastFn("No session listening — type /nitpic in Claude Code. Comments kept.");
        break;
    }
  }

  sendAllBtn.addEventListener("click", () => void sendItems());
  modeBtn.addEventListener("click", () => {
    const on = hooks.toggleMode();
    syncModeButton(on);
  });

  function syncModeButton(on: boolean) {
    modeBtn.textContent = on ? "Stop feedback" : "Start feedback";
    modeBtn.classList.toggle("stop", on);
    updateEmphasis();
  }

  /* ---------- storage sync ---------- */

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.items) render(changes.items.newValue ?? []);
    if (changes.session && open && !collapsed) void refreshStatus();
  });

  /* ---------- public API ---------- */

  async function show() {
    if (open) return;
    open = true;
    await loadState();
    applyPos();
    root.style.display = "block";
    render(await currentItems());
    syncModeButton(hooks.getMode());
    if (collapsed) {
      bubble.classList.add("show");
      panel.classList.add("hidden");
    } else {
      bubble.classList.remove("show");
      // Enter: fade/scale in from the corner.
      panel.classList.add("hidden");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => panel.classList.remove("hidden")),
      );
    }
    void refreshStatus();
    statusTimer = setInterval(() => void refreshStatus(), 5000);
  }

  function hide() {
    if (!open) return;
    open = false;
    panel.classList.add("hidden");
    bubble.classList.remove("show");
    if (statusTimer) clearInterval(statusTimer);
    statusTimer = null;
    setTimeout(() => (root.style.display = "none"), 240);
  }

  return {
    toggle: () => (open ? hide() : void show()),
    isOpen: () => open,
    syncModeButton,
    setToast: (fn: (text: string) => void) => (toastFn = fn),
    destroy: () => {
      if (statusTimer) clearInterval(statusTimer);
      root.remove();
      style.remove();
    },
  };
}
