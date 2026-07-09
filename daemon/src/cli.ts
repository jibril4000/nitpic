#!/usr/bin/env node
import * as fs from "fs";
import { spawn } from "child_process";
import { loadConfig } from "./config";
import { activePath, ensureDir, logPath, nitpicDir, pidPath, socketPath } from "./paths";
import { startServer } from "./server";

function runningPid(): number | null {
  try {
    const pid = parseInt(fs.readFileSync(pidPath(), "utf8").trim(), 10);
    if (!Number.isFinite(pid)) return null;
    process.kill(pid, 0); // throws if not running
    return pid;
  } catch {
    return null;
  }
}

async function cmdStart(foreground: boolean): Promise<void> {
  const pid = runningPid();
  if (pid) {
    console.log(`nitpic-daemon already running (pid ${pid})`);
    return;
  }
  ensureDir(nitpicDir());

  if (!foreground) {
    const logFd = fs.openSync(logPath(), "a");
    const child = spawn(process.execPath, [__filename, "start", "--foreground"], {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: process.env,
    });
    child.unref();
    console.log(`nitpic-daemon started (pid ${child.pid}), log: ${logPath()}`);
    return;
  }

  fs.writeFileSync(pidPath(), String(process.pid));
  const server = await startServer();
  const shutdown = async () => {
    await server.close();
    try {
      fs.unlinkSync(pidPath());
    } catch {}
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

function cmdStop(): void {
  const pid = runningPid();
  if (!pid) {
    console.log("nitpic-daemon is not running");
    return;
  }
  process.kill(pid, "SIGTERM");
  console.log(`nitpic-daemon stopped (pid ${pid})`);
}

function cmdStatus(): void {
  const pid = runningPid();
  const cfg = loadConfig();
  if (pid) {
    console.log(`nitpic-daemon running (pid ${pid})`);
    console.log(`  ws:     ws://127.0.0.1:${cfg.port}`);
    console.log(`  socket: ${socketPath()}`);
  } else {
    console.log("nitpic-daemon is not running");
  }
  console.log(`  config: ${nitpicDir()}/config.json`);
  try {
    const active = JSON.parse(fs.readFileSync(activePath(), "utf8"));
    console.log(`  active session: ${active.projectPath} (via ${active.transport?.kind})`);
  } catch {
    console.log(`  active session: none — type /nitpic in a Claude Code session`);
  }
}

function cmdToken(): void {
  const cfg = loadConfig();
  console.log(cfg.token);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "start":
      await cmdStart(rest.includes("--foreground"));
      break;
    case "stop":
      cmdStop();
      break;
    case "status":
      cmdStatus();
      break;
    case "token":
      cmdToken();
      break;
    default:
      console.log(`nitpic-daemon — feedback switchboard (normally auto-started by /nitpic)

Usage:
  nitpic-daemon start [--foreground]   Start the daemon
  nitpic-daemon stop                   Stop the daemon
  nitpic-daemon status                 Show status and the active session
  nitpic-daemon token                  Print the pairing token (paste into the extension)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
