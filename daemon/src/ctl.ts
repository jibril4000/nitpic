#!/usr/bin/env node
/**
 * nitpic ctl — invoked by the Claude Code plugin (the /nitpic command and
 * session hooks). Talks to the daemon over its Unix socket, auto-starting it
 * when needed. Hook subcommands must be fast and silent when nitpic is idle:
 * they exit 0 immediately if the daemon isn't running.
 */
import * as fs from "fs";
import * as net from "net";
import * as path from "path";
import { spawn, spawnSync } from "child_process";
import type { ActivateResult, CtlToDaemon, DaemonToCtl, Transport } from "@nitpic/shared";
import { ensureDir, nitpicDir, socketPath } from "./paths";

/* ----- session identity ----- */

/** Walk up the process tree to find the `claude` process hosting us. */
function findClaudePid(): number | null {
  let pid = process.ppid;
  for (let depth = 0; depth < 12 && pid > 1; depth++) {
    const out = spawnSync("ps", ["-o", "ppid=,command=", "-p", String(pid)], {
      encoding: "utf8",
    });
    if (out.status !== 0 || !out.stdout) return null;
    const line = out.stdout.trim();
    const m = /^(\d+)\s+(.*)$/.exec(line);
    if (!m) return null;
    const [, ppid, command] = m;
    if (/(^|\/)claude( |$)/.test(command) || /\bclaude\b/.test(path.basename(command.split(" ")[0]))) {
      return pid;
    }
    pid = parseInt(ppid, 10);
  }
  return null;
}

/** Figure out how the daemon can type into this session's terminal. */
function detectTransport(env = process.env): Transport {
  if (env.NITPIC_TEST_INJECT_FILE) return { kind: "file", file: env.NITPIC_TEST_INJECT_FILE };
  if (env.TMUX && env.TMUX_PANE) {
    return { kind: "tmux", socket: env.TMUX.split(",")[0], pane: env.TMUX_PANE };
  }
  if (env.TERM_PROGRAM === "iTerm.app" && env.ITERM_SESSION_ID) {
    const uuid = env.ITERM_SESSION_ID.split(":").pop() ?? env.ITERM_SESSION_ID;
    return { kind: "iterm2", sessionUuid: uuid };
  }
  return { kind: "none", terminal: env.TERM_PROGRAM || undefined };
}

/* ----- daemon socket client ----- */

function requestDaemon(msg: CtlToDaemon, timeoutMs = 3000): Promise<DaemonToCtl | null> {
  return new Promise((resolve) => {
    const conn = net.connect(socketPath());
    let buffer = "";
    const timer = setTimeout(() => {
      conn.destroy();
      resolve(null);
    }, timeoutMs);
    conn.on("connect", () => conn.write(JSON.stringify(msg) + "\n"));
    conn.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const nl = buffer.indexOf("\n");
      if (nl !== -1) {
        clearTimeout(timer);
        conn.destroy();
        try {
          resolve(JSON.parse(buffer.slice(0, nl)));
        } catch {
          resolve(null);
        }
      }
    });
    conn.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

async function ensureDaemon(): Promise<boolean> {
  if (await requestDaemon({ type: "status" }, 500)) return true;
  const daemonJs = path.join(__dirname, "daemon.js");
  const entry = fs.existsSync(daemonJs) ? daemonJs : path.join(__dirname, "cli.js");
  spawn(process.execPath, [entry, "start"], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  }).unref();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (await requestDaemon({ type: "status" }, 500)) return true;
  }
  return false;
}

/* ----- hook stdin ----- */

interface HookInput {
  session_id?: string;
  cwd?: string;
  stop_hook_active?: boolean;
  command_name?: string;
  command_input?: string;
}

function readStdin(): Promise<HookInput> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve({});
    let data = "";
    const timer = setTimeout(() => resolve({}), 2000);
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    process.stdin.on("error", () => resolve({}));
  });
}

/** Copy the pairing token so the user can just Cmd+V it (macOS). */
function copyToClipboard(text: string): boolean {
  const res = spawnSync("pbcopy", [], { input: text, timeout: 2000 });
  return res.status === 0;
}

/* ----- subcommands ----- */

/** Perform activation (or `off`) and return the human-readable report. */
async function activationReport(args: string[], cwd: string): Promise<string> {
  if (args.join(" ").trim().toLowerCase() === "off") {
    const res = await requestDaemon({ type: "deactivate" });
    return res
      ? "nitpic disconnected — browser feedback no longer targets any session."
      : "nitpic daemon isn't running; nothing to disconnect.";
  }

  if (!(await ensureDaemon())) {
    return "ERROR: could not start the nitpic daemon (check ~/.nitpic/daemon.log).";
  }

  const transport = detectTransport();
  const res = (await requestDaemon({
    type: "activate",
    pid: findClaudePid(),
    cwd,
    transport,
  })) as ActivateResult | null;
  if (!res || !res.ok) {
    return "ERROR: daemon did not accept activation.";
  }

  const lines = [
    `NITPIC ACTIVE`,
    `project: ${res.projectPath}`,
    `delivery: ` +
      (res.delivery === "instant"
        ? `instant (${res.transportKind === "iterm2" ? "iTerm2" : res.transportKind} injection)`
        : `on turn boundaries — no instant-injection support for this terminal` +
          ` (runs in tmux or iTerm2 get instant delivery); feedback arrives when Claude` +
          ` finishes its current response or with the user's next message, with a desktop notification`),
    `extension: ${res.extensionConnected ? "connected" : "not connected yet"}`,
  ];
  if (!res.extensionConnected) {
    // No extension talking to us right now. Whatever the reason (first run,
    // reinstalled extension, service worker asleep), put the token on the
    // clipboard so the panel's auto-pairing can self-heal the moment it opens.
    const copied = copyToClipboard(res.token);
    if (!res.paired || res.authFailedRecently) {
      lines.push(
        `pairing needed: the user should click the nitpic toolbar icon in Chrome — the floating panel` +
          ` pairs automatically from the clipboard (token ${res.token} is${copied ? "" : " NOT"} on it; ` +
          `manual entry in the panel also works). No nitpic icon in Chrome? Install the extension first:` +
          ` https://chromewebstore.google.com/detail/eamfkghlemjhefpdlmpjkjadacgcanll`,
      );
    } else {
      lines.push(
        `hint: click the nitpic toolbar icon in Chrome on the page being reviewed to open the floating panel.` +
          ` If it shows "waiting for /nitpic", it will pair itself from the clipboard within a few seconds.`,
      );
    }
  }
  if (res.drained.length > 0) {
    lines.push(``, `Queued feedback delivered now:`, ...res.drained);
  }
  return lines.join("\n");
}

/** Legacy CLI path (also handy for debugging). */
async function cmdActivate(args: string[]): Promise<void> {
  const report = await activationReport(args, process.cwd());
  if (report.startsWith("ERROR")) process.exitCode = 1;
  console.log(report);
}

/**
 * UserPromptExpansion hook: fires when the user invokes /nitpic. Hooks are
 * trusted at plugin install, so activation needs no shell permissions — the
 * command markdown then just has Claude read the report file.
 */
async function cmdExpand(): Promise<void> {
  const input = await readStdin();
  const name = String(input.command_name ?? "");
  if (!/(^|:)nitpic$/.test(name)) return; // some other command expanding
  const args = String(input.command_input ?? "").trim().split(/\s+/).filter(Boolean);
  const report = await activationReport(args, input.cwd ?? process.cwd());
  ensureDir(nitpicDir());
  fs.writeFileSync(
    path.join(nitpicDir(), "last-activate.txt"),
    `generated: ${new Date().toISOString()}\n\n${report}\n`,
  );
}

async function cmdSessionStart(): Promise<void> {
  const input = await readStdin();
  if (!fs.existsSync(socketPath())) return; // daemon not running: nitpic unused
  const res = await requestDaemon({
    type: "session-start",
    pid: findClaudePid(),
    cwd: input.cwd ?? process.cwd(),
    transport: detectTransport(),
    sessionId: input.session_id,
  });
  if (res && res.ok && "drained" in res && res.drained && res.drained.length > 0) {
    const context =
      "Browser feedback was queued for this project while no session was listening:\n\n" +
      res.drained.join("\n\n");
    console.log(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
      }),
    );
  }
}

async function cmdSessionEnd(): Promise<void> {
  const input = await readStdin();
  if (!fs.existsSync(socketPath())) return;
  await requestDaemon({
    type: "session-end",
    pid: findClaudePid(),
    sessionId: input.session_id,
  });
}

async function drainFor(cwd: string | undefined): Promise<string[]> {
  if (!fs.existsSync(socketPath())) return [];
  const res = await requestDaemon({ type: "drain", cwd: cwd ?? process.cwd() });
  return res && res.ok && "drained" in res && res.drained ? res.drained : [];
}

async function cmdDrainStop(): Promise<void> {
  const input = await readStdin();
  const messages = await drainFor(input.cwd);
  if (messages.length > 0) {
    console.log(JSON.stringify({ decision: "block", reason: messages.join("\n\n") }));
  }
}

async function cmdDrainPrompt(): Promise<void> {
  const input = await readStdin();
  const messages = await drainFor(input.cwd);
  if (messages.length > 0) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: "Browser feedback just arrived:\n\n" + messages.join("\n\n"),
        },
      }),
    );
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "activate":
      await cmdActivate(rest);
      break;
    case "expand":
      await cmdExpand();
      break;
    case "session-start":
      await cmdSessionStart();
      break;
    case "session-end":
      await cmdSessionEnd();
      break;
    case "drain-stop":
      await cmdDrainStop();
      break;
    case "drain-prompt":
      await cmdDrainPrompt();
      break;
    default:
      console.log("usage: ctl <activate [off]|session-start|session-end|drain-stop|drain-prompt>");
  }
}

main()
  .catch(() => {
    // Hooks must never break a Claude session over nitpic errors.
  })
  .finally(() => process.exit(process.exitCode ?? 0));
