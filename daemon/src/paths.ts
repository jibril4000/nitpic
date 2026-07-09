import * as os from "os";
import * as path from "path";
import * as fs from "fs";

/** Root state dir. Overridable for tests and parallel setups. */
export function nitpicDir(): string {
  return process.env.NITPIC_DIR || path.join(os.homedir(), ".nitpic");
}

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Canonical form of a project path for comparisons and queue keys. Resolves
 * symlinks (macOS: /var → /private/var) so the extension's mapping and the
 * wrapper's cwd agree on the same directory.
 */
export function canonicalProject(p: string): string {
  const resolved = path.resolve(p);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

export const configPath = () => path.join(nitpicDir(), "config.json");
export const activePath = () => path.join(nitpicDir(), "active.json");
export const socketPath = () => path.join(nitpicDir(), "daemon.sock");
export const pidPath = () => path.join(nitpicDir(), "daemon.pid");
export const logPath = () => path.join(nitpicDir(), "daemon.log");
export const queueDir = () => path.join(nitpicDir(), "queue");
