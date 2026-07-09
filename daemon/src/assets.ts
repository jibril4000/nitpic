import * as fs from "fs";
import * as path from "path";
import type { FeedbackItem } from "@nitpic/shared";
import type { StoredItem } from "./format";

export const FEEDBACK_DIR = ".feedback";
export const MAX_HTML_BYTES = 4096;

let seq = 0;

function nextId(now = new Date()): string {
  const ymd =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  seq = (seq + 1) % 10000;
  const rand = Math.random().toString(36).slice(2, 6);
  return `fb-${ymd}-${String(seq).padStart(4, "0")}${rand}`;
}

/**
 * Write an item's screenshot/HTML into `<project>/.feedback/` and return the
 * item with project-relative asset paths. Also keeps `.gitignore` clean.
 */
export function writeAssets(projectPath: string, item: FeedbackItem): StoredItem {
  const dir = path.join(projectPath, FEEDBACK_DIR);
  fs.mkdirSync(dir, { recursive: true });
  ensureGitignored(projectPath);

  const id = nextId();
  const { html, screenshot, ...rest } = item;
  const stored: StoredItem = { ...rest };

  if (html) {
    let out = html;
    let truncated = item.htmlTruncated ?? false;
    if (Buffer.byteLength(out, "utf8") > MAX_HTML_BYTES) {
      out = truncateUtf8(out, MAX_HTML_BYTES) + "\n<!-- truncated by nitpic -->";
      truncated = true;
    }
    const rel = path.join(FEEDBACK_DIR, `${id}.html`);
    fs.writeFileSync(path.join(projectPath, rel), out);
    stored.htmlPath = rel;
    stored.htmlTruncated = truncated;
  }

  if (screenshot) {
    const m = /^data:image\/png;base64,(.+)$/s.exec(screenshot);
    if (m) {
      const rel = path.join(FEEDBACK_DIR, `${id}.png`);
      fs.writeFileSync(path.join(projectPath, rel), Buffer.from(m[1], "base64"));
      stored.screenshotPath = rel;
    } else {
      stored.screenshotFailed = true;
    }
  }

  return stored;
}

/**
 * Write the full formatted feedback message into `.feedback/` and return its
 * project-relative path. The injected pointer line references this file.
 */
export function writeMessageFile(projectPath: string, text: string): string {
  const dir = path.join(projectPath, FEEDBACK_DIR);
  fs.mkdirSync(dir, { recursive: true });
  ensureGitignored(projectPath);
  const rel = path.join(FEEDBACK_DIR, `${nextId()}.md`);
  fs.writeFileSync(path.join(projectPath, rel), text + "\n");
  return rel;
}

/** Append `.feedback/` to the project's .gitignore if one exists without it. */
export function ensureGitignored(projectPath: string): void {
  const gi = path.join(projectPath, ".gitignore");
  if (!fs.existsSync(gi)) return;
  const content = fs.readFileSync(gi, "utf8");
  const has = content
    .split(/\r?\n/)
    .some((l) => l.trim().replace(/\/$/, "") === FEEDBACK_DIR);
  if (!has) {
    const sep = content.endsWith("\n") || content === "" ? "" : "\n";
    fs.appendFileSync(gi, `${sep}${FEEDBACK_DIR}/\n`);
  }
}

function truncateUtf8(s: string, maxBytes: number): string {
  let out = s;
  while (Buffer.byteLength(out, "utf8") > maxBytes) {
    out = out.slice(0, Math.floor(out.length * 0.9));
  }
  return out;
}
