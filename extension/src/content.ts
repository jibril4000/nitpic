/**
 * Content script: feedback mode. Hover highlights elements, click opens a
 * comment box, drag selects a free region. Runs in a shadow root so page CSS
 * can't interfere and our UI never leaks into captured screenshots (it is
 * hidden before capture).
 */
import type { FeedbackItem, Rect } from "@nitpic/shared";
import { createWidget } from "./widget";

const MAX_HTML = 4096;
let active = false;
let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let widget: ReturnType<typeof createWidget> | null = null;
let hoverBox: HTMLDivElement;
let hoverLabel: HTMLDivElement;
let regionBox: HTMLDivElement;
let popover: HTMLDivElement | null = null;
let toast: HTMLDivElement;
let screenshotDefault = true;

let dragStart: { x: number; y: number } | null = null;
let dragging = false;

/* ------------------------------------------------------------------ */
/* UI scaffolding                                                      */
/* ------------------------------------------------------------------ */

const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; letter-spacing: -0.01em; }
  .hover-box, .region-box {
    position: fixed; pointer-events: none; z-index: 2147483646;
    border: 2px solid #91c31c; background: rgba(145, 195, 28, 0.10);
    border-radius: 6px; display: none;
    box-shadow: 0 0 0 4px rgba(145, 195, 28, 0.16), 0 8px 24px -8px rgba(109, 150, 12, 0.4);
    transition-property: left, top, width, height;
    transition-duration: 0.12s; transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  .region-box { border-style: dashed; transition: none; }
  .hover-label {
    position: fixed; pointer-events: none; z-index: 2147483647; display: none;
    background: rgba(20, 18, 40, 0.92); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
    color: #fff; font-size: 11px; font-weight: 600; padding: 3px 9px;
    border-radius: 100px; max-width: 60vw; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap;
    transition-property: left, top;
    transition-duration: 0.12s; transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  .popover {
    position: fixed; z-index: 2147483647; width: 320px;
    background: rgba(255, 255, 255, 0.88);
    -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%);
    color: #1c1b22; border-radius: 16px; padding: 10px;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(20, 10, 60, 0.08), 0 20px 48px -16px rgba(20, 10, 60, 0.35);
    pointer-events: auto;
    opacity: 0; transform: translateY(6px) scale(0.97); transform-origin: top center;
    transition-property: opacity, transform;
    transition-duration: 0.2s; transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  .popover.in { opacity: 1; transform: none; }
  .popover textarea {
    width: 100%; min-height: 64px; resize: vertical; font-size: 13px; font-family: inherit;
    border: 0; border-radius: 8px; padding: 8px 9px; outline: none;
    color: #1c1b22; background: rgba(20, 18, 40, 0.06);
    box-shadow: 0 0 0 2px transparent;
    transition-property: box-shadow, background-color; transition-duration: 0.18s;
  }
  .popover textarea:focus { box-shadow: 0 0 0 2px rgba(145, 195, 28, 0.55); background: #fff; }
  .popover .row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .popover label { font-size: 12px; color: #5c5966; display: flex; align-items: center; gap: 5px; flex: 1; cursor: pointer; }
  .popover input[type="checkbox"] { accent-color: #7aa716; width: 14px; height: 14px; }
  .popover button {
    font-size: 12px; font-weight: 600; min-height: 34px; padding: 0 14px;
    border-radius: 100px; cursor: pointer; border: 0;
    background: rgba(20, 18, 40, 0.07); color: #1c1b22;
    transition-property: transform, background-color, opacity;
    transition-duration: 0.16s; transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  .popover button:active { transform: scale(0.96); }
  .popover button.primary {
    background: #91c31c; color: #1a2404;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12), 0 6px 16px -6px rgba(145, 195, 28, 0.6);
  }
  .toast {
    position: fixed; bottom: 20px; left: 50%; z-index: 2147483647;
    background: rgba(20, 18, 40, 0.92); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
    color: #fff; font-size: 12px; font-weight: 500; padding: 9px 16px;
    border-radius: 100px; pointer-events: none; white-space: nowrap;
    opacity: 0; transform: translateX(-50%) translateY(10px);
    transition-property: opacity, transform;
    transition-duration: 0.28s; transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  @media (prefers-reduced-motion: reduce) {
    .hover-box, .hover-label, .popover, .toast { transition-duration: 0.01ms; }
  }
`;

function ensureUi(): void {
  if (host) return;
  host = document.createElement("div");
  host.id = "nitpic-root";
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483646;";
  shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLE;
  shadow.append(style);

  hoverBox = mk("div", "hover-box");
  hoverLabel = mk("div", "hover-label");
  regionBox = mk("div", "region-box");
  toast = mk("div", "toast");
  shadow.append(hoverBox, hoverLabel, regionBox, toast);
  document.documentElement.append(host);
}

function mk(tag: string, cls: string): HTMLDivElement {
  const el = document.createElement(tag) as HTMLDivElement;
  el.className = cls;
  return el;
}

function isOurs(target: EventTarget | null): boolean {
  return target instanceof Node && !!host && host.contains(target);
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(text: string): void {
  toast.textContent = text;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ------------------------------------------------------------------ */
/* Selector generation                                                 */
/* ------------------------------------------------------------------ */

function cssPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
    if (cur.id) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      break;
    }
    let part = cur.tagName.toLowerCase();
    const classes = [...cur.classList]
      .filter((c) => !/^\d|^(hover|active|focus)/.test(c))
      .slice(0, 2);
    if (classes.length) part += "." + classes.map((c) => CSS.escape(c)).join(".");

    // Disambiguate among same-tag siblings when needed.
    const parent = cur.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter((s) => s.tagName === cur!.tagName);
      if (siblings.length > 1 && !classes.length) {
        part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
    }
    parts.unshift(part);
    try {
      if (document.querySelectorAll(parts.join(" > ")).length === 1) break;
    } catch {
      /* keep climbing */
    }
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}

/** Nearest meaningful ancestor for the "inside …" hint. */
function ancestorHint(el: Element): string | undefined {
  let cur = el.parentElement;
  while (cur && cur !== document.body) {
    if (cur.id) return `${cur.tagName.toLowerCase()}#${cur.id}`;
    if (/^(form|nav|main|header|footer|aside|section|article)$/i.test(cur.tagName)) {
      const cls = cur.classList[0] ? `.${cur.classList[0]}` : "";
      return cur.tagName.toLowerCase() + cls;
    }
    cur = cur.parentElement;
  }
  return undefined;
}

function shortLabel(el: Element): string {
  let s = el.tagName.toLowerCase();
  if (el.id) s += `#${el.id}`;
  else if (el.classList[0]) s += `.${el.classList[0]}`;
  return s;
}

/* ------------------------------------------------------------------ */
/* Mode toggling + event handlers                                      */
/* ------------------------------------------------------------------ */

/**
 * After an extension reload/update, the old copy of this script keeps running
 * in already-open tabs but can no longer talk to the extension — so the Stop
 * button can't reach it. Detect that and dismantle ourselves entirely.
 */
function isOrphaned(): boolean {
  try {
    return !chrome.runtime?.id;
  } catch {
    return true;
  }
}

function teardown(): void {
  for (const [type, fn] of listeners) window.removeEventListener(type, fn as any, true);
  document.documentElement.style.cursor = "";
  widget?.destroy();
  widget = null;
  host?.remove();
  host = null;
  shadow = null;
  popover = null;
  active = false;
  dragStart = null;
  dragging = false;
}

function ensureWidget() {
  if (widget) return widget;
  ensureUi();
  widget = createWidget(shadow!, {
    toggleMode: () => {
      setMode(!active);
      return active;
    },
    getMode: () => active,
  });
  widget.setToast(showToast);
  return widget;
}

function setMode(on: boolean): void {
  if (on === active) return;
  active = on;
  ensureUi();
  if (on) {
    void chrome.runtime
      .sendMessage({ cmd: "get-status" })
      .then((res) => {
        if (res && typeof res.screenshotDefault === "boolean")
          screenshotDefault = res.screenshotDefault;
      })
      .catch(() => {});
    document.documentElement.style.cursor = "crosshair";
    for (const [type, fn] of listeners) window.addEventListener(type, fn as any, true);
    showToast("Feedback mode on — click an element or drag a region. Esc to exit.");
  } else {
    document.documentElement.style.cursor = "";
    for (const [type, fn] of listeners) window.removeEventListener(type, fn as any, true);
    hoverBox.style.display = "none";
    hoverLabel.style.display = "none";
    regionBox.style.display = "none";
    dragStart = null;
    dragging = false;
    closePopover();
  }
  widget?.syncModeButton(active);
}

function pickElement(x: number, y: number): Element | null {
  const el = document.elementFromPoint(x, y);
  if (!el || el === host || (host && host.contains(el))) return null;
  if (el === document.documentElement || el === document.body) return null;
  return el;
}

function onMouseMove(ev: MouseEvent): void {
  if (isOrphaned()) return teardown();
  if (popover) return;
  if (dragStart) {
    const dx = ev.clientX - dragStart.x;
    const dy = ev.clientY - dragStart.y;
    if (!dragging && Math.hypot(dx, dy) > 6) dragging = true;
    if (dragging) {
      hoverBox.style.display = "none";
      hoverLabel.style.display = "none";
      drawRect(regionBox, normRect(dragStart, { x: ev.clientX, y: ev.clientY }));
      regionBox.style.display = "block";
    }
    return;
  }
  const el = pickElement(ev.clientX, ev.clientY);
  if (!el) {
    hoverBox.style.display = "none";
    hoverLabel.style.display = "none";
    return;
  }
  const r = el.getBoundingClientRect();
  drawRect(hoverBox, { x: r.x, y: r.y, width: r.width, height: r.height });
  hoverBox.style.display = "block";
  hoverLabel.textContent = shortLabel(el);
  hoverLabel.style.left = `${Math.max(0, r.x)}px`;
  hoverLabel.style.top = `${Math.max(0, r.y - 22)}px`;
  hoverLabel.style.display = "block";
}

function onMouseDown(ev: MouseEvent): void {
  if (isOurs(ev.target) || popover) return;
  ev.preventDefault();
  ev.stopPropagation();
  dragStart = { x: ev.clientX, y: ev.clientY };
  dragging = false;
}

function onMouseUp(ev: MouseEvent): void {
  if (isOurs(ev.target) || popover) return;
  ev.preventDefault();
  ev.stopPropagation();
  const start = dragStart;
  dragStart = null;

  if (dragging && start) {
    dragging = false;
    const rect = normRect(start, { x: ev.clientX, y: ev.clientY });
    if (rect.width > 8 && rect.height > 8) {
      const center = pickElement(rect.x + rect.width / 2, rect.y + rect.height / 2);
      openPopover(rect, {
        kind: "region",
        selector: center ? cssPath(center) : undefined,
      });
      return;
    }
    regionBox.style.display = "none";
  }

  const el = pickElement(ev.clientX, ev.clientY);
  if (!el) return;
  const r = el.getBoundingClientRect();
  drawRect(hoverBox, r);
  hoverBox.style.display = "block";
  openPopover(
    { x: r.x, y: r.y, width: r.width, height: r.height },
    {
      kind: "element",
      selector: cssPath(el),
      ancestorHint: ancestorHint(el),
      html: el.outerHTML,
    },
  );
}

function onClick(ev: MouseEvent): void {
  if (isOurs(ev.target)) return;
  // Swallow page clicks entirely while in feedback mode.
  ev.preventDefault();
  ev.stopPropagation();
}

function onKeyDown(ev: KeyboardEvent): void {
  if (isOrphaned()) return teardown();
  if (ev.key === "Escape") {
    ev.preventDefault();
    ev.stopPropagation();
    if (popover) closePopover();
    else setMode(false);
  }
}

const listeners: Array<[string, EventListener]> = [
  ["mousemove", onMouseMove as EventListener],
  ["mousedown", onMouseDown as EventListener],
  ["mouseup", onMouseUp as EventListener],
  ["click", onClick as EventListener],
  ["keydown", onKeyDown as EventListener],
];

function normRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function drawRect(el: HTMLElement, r: { x: number; y: number; width: number; height: number }): void {
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
}

/* ------------------------------------------------------------------ */
/* Comment popover                                                     */
/* ------------------------------------------------------------------ */

interface Draft {
  kind: "element" | "region";
  selector?: string;
  ancestorHint?: string;
  html?: string;
}

function openPopover(rect: Rect, draft: Draft): void {
  closePopover();
  popover = mk("div", "popover");
  popover.innerHTML = `
    <textarea placeholder="What should change here?"></textarea>
    <div class="row">
      <label><input type="checkbox" class="shot" ${screenshotDefault ? "checked" : ""}/> Screenshot</label>
      <button class="cancel">Cancel</button>
      <button class="primary send">Add</button>
    </div>`;
  shadow!.append(popover);

  // Anchor below the selection, clamped to the viewport.
  const pw = 320;
  const left = Math.min(Math.max(8, rect.x), window.innerWidth - pw - 8);
  const below = rect.y + rect.height + 10;
  const top = below + 140 < window.innerHeight ? below : Math.max(8, rect.y - 150);
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  if (top < rect.y) popover.style.transformOrigin = "bottom center";
  requestAnimationFrame(() =>
    requestAnimationFrame(() => popover?.classList.add("in")),
  );

  const textarea = popover.querySelector("textarea")!;
  const shotBox = popover.querySelector<HTMLInputElement>(".shot")!;
  textarea.focus();

  const save = () => {
    const comment = textarea.value.trim();
    if (!comment) return;
    void saveItem(rect, draft, comment, shotBox.checked);
  };

  popover.querySelector(".send")!.addEventListener("click", save);
  popover.querySelector(".cancel")!.addEventListener("click", closePopover);
  textarea.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      save();
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      closePopover();
    }
  });
}

function closePopover(): void {
  popover?.remove();
  popover = null;
  hoverBox.style.display = "none";
  regionBox.style.display = "none";
  hoverLabel.style.display = "none";
}

async function saveItem(
  rect: Rect,
  draft: Draft,
  comment: string,
  wantScreenshot: boolean,
): Promise<void> {
  let html = draft.html;
  let htmlTruncated = false;
  if (html && html.length > MAX_HTML) {
    html = html.slice(0, MAX_HTML);
    htmlTruncated = true;
  }
  const item: FeedbackItem = {
    id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: draft.kind,
    url: location.href,
    comment,
    selector: draft.selector,
    ancestorHint: draft.ancestorHint,
    html,
    htmlTruncated,
    rect,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    createdAt: new Date().toISOString(),
  };

  // Hide our UI so it never appears in the screenshot.
  host!.style.display = "none";
  closePopover();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const res = await chrome.runtime.sendMessage({
      cmd: "capture-item",
      item,
      wantScreenshot,
      dpr: window.devicePixelRatio || 1,
    });
    host!.style.display = "";
    if (res?.ok) {
      showToast(
        res.screenshotFailed
          ? `Saved (${res.count}) — screenshot failed, comment kept`
          : `Saved (${res.count} in panel)`,
      );
    } else {
      showToast(`Failed to save: ${res?.error ?? "unknown error"}`);
    }
  } catch {
    host!.style.display = "";
    showToast("Failed to save — extension unavailable");
  }
}

/* ------------------------------------------------------------------ */

// Guard against double-injection: the manifest injects on page load, and the
// background also injects on demand into pages opened before install.
declare global {
  interface Window {
    __nitpicLoaded?: boolean;
  }
}

if (!window.__nitpicLoaded) {
  window.__nitpicLoaded = true;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.cmd === "toggle-mode") {
      setMode(!active);
      sendResponse({ active });
    } else if (msg.cmd === "set-mode") {
      setMode(Boolean(msg.active));
      sendResponse({ active });
    } else if (msg.cmd === "get-mode") {
      sendResponse({ active });
    } else if (msg.cmd === "toggle-widget") {
      ensureWidget().toggle();
      sendResponse({ ok: true });
    }
  });
}
