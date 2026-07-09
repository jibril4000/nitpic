import * as fs from "fs";
import * as net from "net";
import * as path from "path";
import { WebSocketServer, WebSocket } from "ws";
import type {
  ActiveSessionInfo,
  CtlToDaemon,
  DaemonToCtl,
  DaemonToExt,
  ExtToDaemon,
  FeedbackItem,
  SubmitResult,
  Transport,
} from "@nitpic/shared";
import { Config, loadConfig, saveConfig } from "./config";
import { writeAssets, writeMessageFile } from "./assets";
import { formatMessage, pointerLine } from "./format";
import { drain, enqueue } from "./queue";
import { activePath, canonicalProject, socketPath } from "./paths";
import { inject, notify } from "./transport";

/** The one session currently listening for browser feedback. */
interface ActiveSession {
  pid: number | null;
  sessionId?: string;
  projectPath: string;
  transport: Transport;
  activatedAt: number;
}

export interface RunningServer {
  close(): Promise<void>;
  port: number;
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function pidAlive(pid: number | null): boolean {
  if (pid === null) return true; // unknown pid: assume alive, hooks will correct
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function transportEquals(a: Transport, b: Transport): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "tmux" && b.kind === "tmux")
    return a.socket === b.socket && a.pane === b.pane;
  if (a.kind === "iterm2" && b.kind === "iterm2")
    return a.sessionUuid === b.sessionUuid;
  if (a.kind === "file" && b.kind === "file") return a.file === b.file;
  return false; // two "none" transports are never comparable
}

function loadActive(): ActiveSession | null {
  try {
    return JSON.parse(fs.readFileSync(activePath(), "utf8"));
  } catch {
    return null;
  }
}

function saveActive(active: ActiveSession | null): void {
  if (active) fs.writeFileSync(activePath(), JSON.stringify(active, null, 2) + "\n");
  else if (fs.existsSync(activePath())) fs.unlinkSync(activePath());
}

export async function startServer(): Promise<RunningServer> {
  let cfg: Config = loadConfig();
  let active: ActiveSession | null = loadActive();
  const extClients = new Set<WebSocket>();
  let lastAuthFailure = 0;

  function sessionInfo(): ActiveSessionInfo | null {
    if (!active) return null;
    if (!pidAlive(active.pid)) {
      log(`active session pid ${active.pid} is gone; clearing`);
      setActive(null);
      return null;
    }
    return {
      projectPath: active.projectPath,
      displayName: path.basename(active.projectPath),
      delivery: active.transport.kind === "none" ? "next-turn" : "instant",
    };
  }

  function pushState(): void {
    const msg: DaemonToExt = { type: "state", session: sessionInfo() };
    const raw = JSON.stringify(msg);
    for (const ws of extClients) ws.send(raw);
  }

  function setActive(next: ActiveSession | null): void {
    active = next;
    saveActive(active);
    pushState();
  }

  /* ----- plugin ctl IPC over Unix domain socket (one-shot NDJSON) ----- */

  const sock = socketPath();
  if (fs.existsSync(sock)) fs.unlinkSync(sock); // stale socket from a crash

  const ipc = net.createServer((conn) => {
    let buffer = "";
    conn.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const nl = buffer.indexOf("\n");
      if (nl === -1) return;
      const line = buffer.slice(0, nl);
      let msg: CtlToDaemon;
      try {
        msg = JSON.parse(line);
      } catch {
        conn.end(JSON.stringify({ ok: false, error: "bad request" }) + "\n");
        return;
      }
      let res: DaemonToCtl;
      try {
        res = handleCtl(msg);
      } catch (err) {
        res = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      conn.end(JSON.stringify(res) + "\n");
    });
    conn.on("error", () => {});
  });

  function handleCtl(msg: CtlToDaemon): DaemonToCtl {
    switch (msg.type) {
      case "activate": {
        const projectPath = canonicalProject(msg.cwd);
        setActive({
          pid: msg.pid,
          sessionId: msg.sessionId,
          projectPath,
          transport: msg.transport,
          activatedAt: Date.now(),
        });
        const drained = drain(projectPath);
        log(
          `activated: ${projectPath} via ${msg.transport.kind} (pid ${msg.pid ?? "?"})` +
            (drained.length ? `, drained ${drained.length} queued message(s)` : ""),
        );
        return {
          ok: true,
          projectPath,
          delivery: msg.transport.kind === "none" ? "next-turn" : "instant",
          transportKind: msg.transport.kind,
          extensionConnected: extClients.size > 0,
          paired: cfg.paired,
          authFailedRecently: Date.now() - lastAuthFailure < 10 * 60_000,
          token: cfg.token,
          port: cfg.port,
          drained,
        };
      }

      case "deactivate":
        if (active) log(`deactivated: ${active.projectPath}`);
        setActive(null);
        return { ok: true };

      case "session-start": {
        // A session restarted in the same terminal as the active one
        // (e.g. the user quit and reran `claude`): re-bind automatically.
        let reactivated = false;
        if (
          active &&
          canonicalProject(msg.cwd) === active.projectPath &&
          (transportEquals(active.transport, msg.transport) || !pidAlive(active.pid))
        ) {
          setActive({ ...active, pid: msg.pid, sessionId: msg.sessionId, transport: msg.transport });
          reactivated = true;
          log(`re-activated ${active.projectPath} for restarted session (pid ${msg.pid ?? "?"})`);
        }
        const drained = drain(canonicalProject(msg.cwd));
        return { ok: true, reactivated, drained };
      }

      case "session-end": {
        const matches =
          active &&
          ((msg.sessionId && active.sessionId === msg.sessionId) ||
            (msg.pid !== null && active.pid === msg.pid));
        if (matches) {
          log(`active session ended: ${active!.projectPath}`);
          setActive(null);
        }
        return { ok: true };
      }

      case "drain":
        return { ok: true, drained: drain(canonicalProject(msg.cwd)) };

      case "status":
        return {
          ok: true,
          running: true,
          port: cfg.port,
          active: active
            ? { projectPath: active.projectPath, transportKind: active.transport.kind }
            : null,
          extensionConnected: extClients.size > 0,
        };
    }
  }

  await new Promise<void>((resolve, reject) => {
    ipc.once("error", reject);
    ipc.listen(sock, () => resolve());
  });

  /* ----- extension WebSocket server ----- */

  const wss = new WebSocketServer({ host: "127.0.0.1", port: cfg.port });
  await new Promise<void>((resolve, reject) => {
    wss.once("error", reject);
    wss.once("listening", () => resolve());
  });
  log(`listening on ws://127.0.0.1:${cfg.port} and ${sock}`);

  wss.on("connection", (ws) => {
    let authed = false;
    const send = (msg: DaemonToExt) => ws.send(JSON.stringify(msg));

    ws.on("message", async (raw) => {
      let msg: ExtToDaemon;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === "hello") {
        if (msg.token === cfg.token) {
          authed = true;
          extClients.add(ws);
          if (!cfg.paired) {
            cfg = { ...cfg, paired: true };
            saveConfig(cfg);
            log("extension paired for the first time");
          }
          send({ type: "hello-ok" });
          send({ type: "state", session: sessionInfo() });
        } else {
          lastAuthFailure = Date.now();
          send({ type: "hello-error", message: "invalid token" });
          ws.close();
        }
        return;
      }
      if (!authed) {
        send({ type: "error", message: "not authenticated" });
        return;
      }

      switch (msg.type) {
        case "ping":
          send({ type: "pong" });
          break;
        case "submit":
          try {
            const result = await handleSubmit(msg.items);
            send({ type: "submit-result", requestId: msg.requestId, result });
          } catch (err) {
            send({
              type: "error",
              requestId: msg.requestId,
              message: err instanceof Error ? err.message : String(err),
            });
          }
          break;
      }
    });
    ws.on("close", () => extClients.delete(ws));
    ws.on("error", () => {});
  });

  async function handleSubmit(items: FeedbackItem[]): Promise<SubmitResult> {
    const itemIds = items.map((i) => i.id);
    if (!sessionInfo() || !active) {
      log(`submit with no active session (${items.length} item(s)); extension keeps them`);
      return { status: "no-session", projectPath: null, itemIds };
    }

    const project = active.projectPath;
    const stored = items.map((item) => writeAssets(project, item));
    const messagePath = writeMessageFile(project, formatMessage(stored));
    const line = pointerLine(messagePath, items.length);

    const injected = await inject(active.transport, line);
    if (injected) {
      log(`delivered ${items.length} item(s) to ${project} via ${active.transport.kind}`);
      return { status: "delivered", projectPath: project, itemIds };
    }

    // No injection path (or it failed): queue for the hooks to pick up on
    // Claude's next turn boundary, and nudge the user via notification.
    enqueue(project, line);
    notify("Feedback waiting — it will reach Claude on its next turn (or your next message).");
    log(`queued ${items.length} item(s) for ${project} (transport ${active.transport.kind})`);
    return { status: "queued", projectPath: project, itemIds };
  }

  return {
    port: cfg.port,
    close: async () => {
      for (const ws of extClients) ws.terminate(); // don't wait on open panels
      await new Promise<void>((r) => wss.close(() => r()));
      await new Promise<void>((r) => ipc.close(() => r()));
      if (fs.existsSync(sock)) fs.unlinkSync(sock);
    },
  };
}
