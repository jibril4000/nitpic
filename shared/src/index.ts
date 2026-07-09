/** Wire protocol shared by the extension, daemon (switchboard), and plugin ctl. */

export interface Viewport {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FeedbackKind = "element" | "region";

/** One captured comment, as produced by the extension. */
export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  url: string;
  comment: string;
  /** CSS selector for the element (element kind only). */
  selector?: string;
  /** Human-readable anchor, e.g. `form#account-settings`. */
  ancestorHint?: string;
  /** outerHTML snippet, already truncated by the extension. */
  html?: string;
  htmlTruncated?: boolean;
  /** PNG data URL, cropped to the selection. Absent if disabled or failed. */
  screenshot?: string;
  screenshotFailed?: boolean;
  rect: Rect;
  viewport: Viewport;
  createdAt: string;
}

/* ---------- transports (how the daemon reaches a terminal) ---------- */

export type Transport =
  | { kind: "tmux"; socket: string; pane: string }
  | { kind: "iterm2"; sessionUuid: string }
  /** Test-only: append injected lines to a file. */
  | { kind: "file"; file: string }
  /** No injection path — delivery falls back to hooks + notification. */
  | { kind: "none"; terminal?: string };

/** What the extension needs to know about the listening session. */
export interface ActiveSessionInfo {
  projectPath: string;
  /** Short display name, e.g. the project folder name. */
  displayName: string;
  /** "instant" if an injection transport exists, "next-turn" otherwise. */
  delivery: "instant" | "next-turn";
}

/* ---------- extension → daemon (WebSocket) ---------- */

export type ExtToDaemon =
  | { type: "hello"; token: string }
  | { type: "ping" }
  | { type: "submit"; requestId: string; items: FeedbackItem[] };

export type SubmitStatus = "delivered" | "queued" | "no-session";

export interface SubmitResult {
  status: SubmitStatus;
  projectPath: string | null;
  itemIds: string[];
}

export type DaemonToExt =
  | { type: "hello-ok" }
  | { type: "hello-error"; message: string }
  | { type: "pong" }
  | { type: "error"; requestId?: string; message: string }
  | { type: "submit-result"; requestId: string; result: SubmitResult }
  /** Pushed on connect and whenever the active session changes. */
  | { type: "state"; session: ActiveSessionInfo | null };

/* ---------- plugin ctl ↔ daemon (Unix socket, one-shot NDJSON) ---------- */

export type CtlToDaemon =
  | {
      type: "activate";
      pid: number | null;
      cwd: string;
      transport: Transport;
      sessionId?: string;
    }
  | { type: "deactivate" }
  | {
      type: "session-start";
      pid: number | null;
      cwd: string;
      transport: Transport;
      sessionId?: string;
    }
  | { type: "session-end"; pid: number | null; sessionId?: string }
  | { type: "drain"; cwd: string }
  | { type: "status" };

export interface ActivateResult {
  ok: true;
  projectPath: string;
  delivery: "instant" | "next-turn";
  transportKind: Transport["kind"];
  extensionConnected: boolean;
  /** True once an extension has ever paired successfully. */
  paired: boolean;
  /** True if an extension recently failed auth (e.g. reinstalled → needs re-pairing). */
  authFailedRecently: boolean;
  token: string;
  port: number;
  /** Feedback that was queued for this project, delivered now. */
  drained: string[];
}

export type DaemonToCtl =
  | ActivateResult
  | { ok: true; drained?: string[]; reactivated?: boolean }
  | {
      ok: true;
      running: true;
      port: number;
      active: { projectPath: string; transportKind: string } | null;
      extensionConnected: boolean;
    }
  | { ok: false; error: string };
