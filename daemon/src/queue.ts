import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { canonicalProject, ensureDir, queueDir } from "./paths";

interface QueueEntry {
  message: string;
  queuedAt: string;
}

function queueFile(projectPath: string): string {
  const hash = crypto
    .createHash("sha1")
    .update(canonicalProject(projectPath))
    .digest("hex")
    .slice(0, 16);
  return path.join(queueDir(), `${hash}.jsonl`);
}

/** Persist a formatted message for delivery when a session registers. */
export function enqueue(projectPath: string, message: string): void {
  ensureDir(queueDir());
  const entry: QueueEntry = { message, queuedAt: new Date().toISOString() };
  fs.appendFileSync(queueFile(projectPath), JSON.stringify(entry) + "\n");
}

export function pending(projectPath: string): number {
  const file = queueFile(projectPath);
  if (!fs.existsSync(file)) return 0;
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim()).length;
}

/** Read all queued messages for a project (oldest first) and clear the queue. */
export function drain(projectPath: string): string[] {
  const file = queueFile(projectPath);
  if (!fs.existsSync(file)) return [];
  const lines = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim());
  fs.unlinkSync(file);
  const out: string[] = [];
  for (const line of lines) {
    try {
      out.push((JSON.parse(line) as QueueEntry).message);
    } catch {
      // skip corrupt line
    }
  }
  return out;
}
