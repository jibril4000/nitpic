import * as fs from "fs";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { CtlToDaemon, DaemonToCtl, DaemonToExt, FeedbackItem } from "@nitpic/shared";
import { loadConfig } from "../src/config";
import { socketPath } from "../src/paths";
import { startServer, RunningServer } from "../src/server";

let tmp: string;
let project: string;
let server: RunningServer;
let token: string;

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function item(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "element",
    url: "http://localhost:3000/",
    comment: "make it pop",
    selector: "button.save",
    screenshot: PNG_1PX,
    rect: { x: 0, y: 0, width: 10, height: 10 },
    viewport: { width: 1440, height: 900 },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function ctl(msg: CtlToDaemon): Promise<DaemonToCtl> {
  return new Promise((resolve, reject) => {
    const conn = net.connect(socketPath());
    let buf = "";
    conn.on("connect", () => conn.write(JSON.stringify(msg) + "\n"));
    conn.on("data", (c) => {
      buf += c.toString();
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        conn.destroy();
        resolve(JSON.parse(buf.slice(0, nl)));
      }
    });
    conn.on("error", reject);
  });
}

/** Paired ws client that collects pushed messages and answers requests. */
async function extClient(): Promise<{
  ws: WebSocket;
  pushed: DaemonToExt[];
  request: (msg: object) => Promise<any>;
  close: () => void;
}> {
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
  const pushed: DaemonToExt[] = [];
  const waiters = new Map<string, (msg: any) => void>();
  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => ws.send(JSON.stringify({ type: "hello", token })));
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === "hello-ok") return resolve();
      if (msg.type === "hello-error") return reject(new Error(msg.message));
      if (msg.requestId && waiters.has(msg.requestId)) {
        waiters.get(msg.requestId)!(msg);
        waiters.delete(msg.requestId);
      } else {
        pushed.push(msg);
      }
    });
    ws.on("error", reject);
  });
  return {
    ws,
    pushed,
    request: (msg: any) =>
      new Promise((resolve) => {
        const requestId = Math.random().toString(36).slice(2);
        waiters.set(requestId, resolve);
        ws.send(JSON.stringify({ ...msg, requestId }));
      }),
    close: () => ws.close(),
  };
}

const waitFor = async (cond: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
};

beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nitpic-test-"));
  process.env.NITPIC_DIR = path.join(tmp, "state");
  project = fs.mkdtempSync(path.join(tmp, "project-"));
  fs.writeFileSync(path.join(project, ".gitignore"), "node_modules/\n");
  const cfg = loadConfig();
  // Rebind to a random free port per test run to avoid clashes.
  cfg.port = 20000 + Math.floor(Math.random() * 20000);
  fs.writeFileSync(path.join(process.env.NITPIC_DIR!, "config.json"), JSON.stringify(cfg));
  token = cfg.token;
  server = await startServer();
});

afterEach(async () => {
  await server.close();
  delete process.env.NITPIC_DIR;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("switchboard", () => {
  it("reports no-session when nothing is activated", async () => {
    const ext = await extClient();
    const res = await ext.request({ type: "submit", items: [item()] });
    expect(res.result.status).toBe("no-session");
    ext.close();
  });

  it("activate → state push → submit injects a pointer line and writes assets", async () => {
    const injectFile = path.join(tmp, "injected.txt");
    const ext = await extClient();

    const act = await ctl({
      type: "activate",
      pid: process.pid,
      cwd: project,
      transport: { kind: "file", file: injectFile },
    });
    expect(act.ok).toBe(true);
    if (act.ok && "delivery" in act) expect(act.delivery).toBe("instant");

    // Extension hears about the new active session.
    await waitFor(() =>
      ext.pushed.some((m) => m.type === "state" && m.session?.projectPath === fs.realpathSync(project)),
    );

    const res = await ext.request({ type: "submit", items: [item(), item({ kind: "region", selector: undefined })] });
    expect(res.result.status).toBe("delivered");

    const line = fs.readFileSync(injectFile, "utf8").trim();
    expect(line).toMatch(/^New browser feedback \(2 items\) — please read \.feedback\/fb-.*\.md/);

    const mdRel = /read (\.feedback\/[\w.-]+\.md)/.exec(line)![1];
    const md = fs.readFileSync(path.join(fs.realpathSync(project), mdRel), "utf8");
    expect(md).toContain("make it pop");
    expect(md).toContain("Screenshot: .feedback/");

    // .gitignore hygiene carried over.
    expect(fs.readFileSync(path.join(project, ".gitignore"), "utf8")).toContain(".feedback/");
    ext.close();
  });

  it("queues when transport is none, drains via ctl (hook path)", async () => {
    const ext = await extClient();
    await ctl({ type: "activate", pid: process.pid, cwd: project, transport: { kind: "none" } });

    const res = await ext.request({ type: "submit", items: [item()] });
    expect(res.result.status).toBe("queued");

    const drained = await ctl({ type: "drain", cwd: project });
    expect(drained.ok && "drained" in drained && drained.drained!.length).toBe(1);

    // Second drain is empty (no double delivery).
    const again = await ctl({ type: "drain", cwd: project });
    expect(again.ok && "drained" in again && again.drained!.length).toBe(0);
    ext.close();
  });

  it("session-end clears the active session and pushes state", async () => {
    const ext = await extClient();
    await ctl({
      type: "activate",
      pid: process.pid,
      cwd: project,
      transport: { kind: "file", file: path.join(tmp, "x.txt") },
      sessionId: "s1",
    });
    await waitFor(() => ext.pushed.some((m) => m.type === "state" && m.session !== null));

    await ctl({ type: "session-end", pid: process.pid, sessionId: "s1" });
    await waitFor(() => ext.pushed.some((m) => m.type === "state" && m.session === null));

    const res = await ext.request({ type: "submit", items: [item()] });
    expect(res.result.status).toBe("no-session");
    ext.close();
  });

  it("session-start in the same terminal re-activates and delivers the backlog", async () => {
    const injectFile = path.join(tmp, "injected.txt");
    const transport = { kind: "file", file: injectFile } as const;
    await ctl({ type: "activate", pid: 99999999, cwd: project, transport, sessionId: "old" });

    // Old session died without a clean session-end; feedback queues meanwhile.
    const ext = await extClient();
    const res = await ext.request({ type: "submit", items: [item()] });
    expect(res.result.status).toBe("no-session"); // dead pid detected → cleared

    // Queue something for the project via a live activation that then ends.
    await ctl({ type: "activate", pid: process.pid, cwd: project, transport: { kind: "none" }, sessionId: "tmp" });
    await ext.request({ type: "submit", items: [item()] });

    // New session starts in the same project: backlog comes back with it.
    const start = await ctl({
      type: "session-start",
      pid: process.pid,
      cwd: project,
      transport,
      sessionId: "new",
    });
    expect(start.ok && "drained" in start && start.drained!.length).toBe(1);
    ext.close();
  });

  it("rejects a bad pairing token", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    const result = await new Promise<string>((resolve) => {
      ws.on("open", () => ws.send(JSON.stringify({ type: "hello", token: "wrong" })));
      ws.on("message", (raw) => resolve(JSON.parse(String(raw)).type));
    });
    expect(result).toBe("hello-error");
    ws.close();
  });
});
