#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/ctl.ts
var fs2 = __toESM(require("fs"));
var net = __toESM(require("net"));
var path2 = __toESM(require("path"));
var import_child_process = require("child_process");

// src/paths.ts
var os = __toESM(require("os"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
function nitpicDir() {
  return process.env.NITPIC_DIR || path.join(os.homedir(), ".nitpic");
}
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
var socketPath = () => path.join(nitpicDir(), "daemon.sock");

// src/ctl.ts
function findClaudePid() {
  let pid = process.ppid;
  for (let depth = 0; depth < 12 && pid > 1; depth++) {
    const out = (0, import_child_process.spawnSync)("ps", ["-o", "ppid=,command=", "-p", String(pid)], {
      encoding: "utf8"
    });
    if (out.status !== 0 || !out.stdout) return null;
    const line = out.stdout.trim();
    const m = /^(\d+)\s+(.*)$/.exec(line);
    if (!m) return null;
    const [, ppid, command] = m;
    if (/(^|\/)claude( |$)/.test(command) || /\bclaude\b/.test(path2.basename(command.split(" ")[0]))) {
      return pid;
    }
    pid = parseInt(ppid, 10);
  }
  return null;
}
function detectTransport(env = process.env) {
  if (env.NITPIC_TEST_INJECT_FILE) return { kind: "file", file: env.NITPIC_TEST_INJECT_FILE };
  if (env.TMUX && env.TMUX_PANE) {
    return { kind: "tmux", socket: env.TMUX.split(",")[0], pane: env.TMUX_PANE };
  }
  if (env.TERM_PROGRAM === "iTerm.app" && env.ITERM_SESSION_ID) {
    const uuid = env.ITERM_SESSION_ID.split(":").pop() ?? env.ITERM_SESSION_ID;
    return { kind: "iterm2", sessionUuid: uuid };
  }
  return { kind: "none", terminal: env.TERM_PROGRAM || void 0 };
}
function requestDaemon(msg, timeoutMs = 3e3) {
  return new Promise((resolve2) => {
    const conn = net.connect(socketPath());
    let buffer = "";
    const timer = setTimeout(() => {
      conn.destroy();
      resolve2(null);
    }, timeoutMs);
    conn.on("connect", () => conn.write(JSON.stringify(msg) + "\n"));
    conn.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const nl = buffer.indexOf("\n");
      if (nl !== -1) {
        clearTimeout(timer);
        conn.destroy();
        try {
          resolve2(JSON.parse(buffer.slice(0, nl)));
        } catch {
          resolve2(null);
        }
      }
    });
    conn.on("error", () => {
      clearTimeout(timer);
      resolve2(null);
    });
  });
}
async function ensureDaemon() {
  if (await requestDaemon({ type: "status" }, 500)) return true;
  const daemonJs = path2.join(__dirname, "daemon.js");
  const entry = fs2.existsSync(daemonJs) ? daemonJs : path2.join(__dirname, "cli.js");
  (0, import_child_process.spawn)(process.execPath, [entry, "start"], {
    detached: true,
    stdio: "ignore",
    env: process.env
  }).unref();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (await requestDaemon({ type: "status" }, 500)) return true;
  }
  return false;
}
function readStdin() {
  return new Promise((resolve2) => {
    if (process.stdin.isTTY) return resolve2({});
    let data = "";
    const timer = setTimeout(() => resolve2({}), 2e3);
    process.stdin.on("data", (c) => data += c);
    process.stdin.on("end", () => {
      clearTimeout(timer);
      try {
        resolve2(JSON.parse(data));
      } catch {
        resolve2({});
      }
    });
    process.stdin.on("error", () => resolve2({}));
  });
}
function copyToClipboard(text) {
  const res = (0, import_child_process.spawnSync)("pbcopy", [], { input: text, timeout: 2e3 });
  return res.status === 0;
}
async function activationReport(args, cwd) {
  if (args.join(" ").trim().toLowerCase() === "off") {
    const res2 = await requestDaemon({ type: "deactivate" });
    return res2 ? "nitpic disconnected \u2014 browser feedback no longer targets any session." : "nitpic daemon isn't running; nothing to disconnect.";
  }
  if (!await ensureDaemon()) {
    return "ERROR: could not start the nitpic daemon (check ~/.nitpic/daemon.log).";
  }
  const transport = detectTransport();
  const res = await requestDaemon({
    type: "activate",
    pid: findClaudePid(),
    cwd,
    transport
  });
  if (!res || !res.ok) {
    return "ERROR: daemon did not accept activation.";
  }
  const lines = [
    `NITPIC ACTIVE`,
    `project: ${res.projectPath}`,
    `delivery: ` + (res.delivery === "instant" ? `instant (${res.transportKind === "iterm2" ? "iTerm2" : res.transportKind} injection)` : `on turn boundaries \u2014 no instant-injection support for this terminal (runs in tmux or iTerm2 get instant delivery); feedback arrives when Claude finishes its current response or with the user's next message, with a desktop notification`),
    `extension: ${res.extensionConnected ? "connected" : "not connected yet"}`
  ];
  if (!res.extensionConnected) {
    const copied = copyToClipboard(res.token);
    if (!res.paired || res.authFailedRecently) {
      lines.push(
        `pairing needed: the user should click the nitpic toolbar icon in Chrome \u2014 the floating panel pairs automatically from the clipboard (token ${res.token} is${copied ? "" : " NOT"} on it; manual entry in the panel also works). No nitpic icon in Chrome? Install the extension first: https://chromewebstore.google.com/detail/eamfkghlemjhefpdlmpjkjadacgcanll`
      );
    } else {
      lines.push(
        `hint: click the nitpic toolbar icon in Chrome on the page being reviewed to open the floating panel. If it shows "waiting for /nitpic", it will pair itself from the clipboard within a few seconds.`
      );
    }
  }
  if (res.drained.length > 0) {
    lines.push(``, `Queued feedback delivered now:`, ...res.drained);
  }
  return lines.join("\n");
}
async function cmdActivate(args) {
  const report = await activationReport(args, process.cwd());
  if (report.startsWith("ERROR")) process.exitCode = 1;
  console.log(report);
}
async function cmdExpand() {
  const input = await readStdin();
  const name = String(input.command_name ?? "");
  if (!/(^|:)nitpic$/.test(name)) return;
  const args = String(input.command_input ?? "").trim().split(/\s+/).filter(Boolean);
  const report = await activationReport(args, input.cwd ?? process.cwd());
  ensureDir(nitpicDir());
  fs2.writeFileSync(
    path2.join(nitpicDir(), "last-activate.txt"),
    `generated: ${(/* @__PURE__ */ new Date()).toISOString()}

${report}
`
  );
}
async function cmdSessionStart() {
  const input = await readStdin();
  if (!fs2.existsSync(socketPath())) return;
  const res = await requestDaemon({
    type: "session-start",
    pid: findClaudePid(),
    cwd: input.cwd ?? process.cwd(),
    transport: detectTransport(),
    sessionId: input.session_id
  });
  if (res && res.ok && "drained" in res && res.drained && res.drained.length > 0) {
    const context = "Browser feedback was queued for this project while no session was listening:\n\n" + res.drained.join("\n\n");
    console.log(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context }
      })
    );
  }
}
async function cmdSessionEnd() {
  const input = await readStdin();
  if (!fs2.existsSync(socketPath())) return;
  await requestDaemon({
    type: "session-end",
    pid: findClaudePid(),
    sessionId: input.session_id
  });
}
async function drainFor(cwd) {
  if (!fs2.existsSync(socketPath())) return [];
  const res = await requestDaemon({ type: "drain", cwd: cwd ?? process.cwd() });
  return res && res.ok && "drained" in res && res.drained ? res.drained : [];
}
async function cmdDrainStop() {
  const input = await readStdin();
  const messages = await drainFor(input.cwd);
  if (messages.length > 0) {
    console.log(JSON.stringify({ decision: "block", reason: messages.join("\n\n") }));
  }
}
async function cmdDrainPrompt() {
  const input = await readStdin();
  const messages = await drainFor(input.cwd);
  if (messages.length > 0) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: "Browser feedback just arrived:\n\n" + messages.join("\n\n")
        }
      })
    );
  }
}
async function main() {
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
main().catch(() => {
}).finally(() => process.exit(process.exitCode ?? 0));
