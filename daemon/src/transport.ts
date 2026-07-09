import * as fs from "fs";
import { execFile } from "child_process";
import type { Transport } from "@nitpic/shared";

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000 }, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Type a single line into the session's terminal and submit it, as if the
 * user typed it. The line is always daemon-composed (a pointer to a
 * `.feedback/*.md` file) — never raw user text — so no terminal-escaping of
 * user content is ever needed.
 */
export async function inject(transport: Transport, line: string): Promise<boolean> {
  try {
    switch (transport.kind) {
      case "tmux":
        // -l sends the literal text; a separate Enter submits it.
        await run("tmux", ["-S", transport.socket, "send-keys", "-t", transport.pane, "-l", "--", line]);
        await run("tmux", ["-S", transport.socket, "send-keys", "-t", transport.pane, "Enter"]);
        return true;
      case "iterm2": {
        // `write text` appends a newline, which submits the message.
        const script = [
          "on run argv",
          "  set targetId to item 1 of argv",
          "  set msg to item 2 of argv",
          '  tell application "iTerm2"',
          "    repeat with w in windows",
          "      repeat with t in tabs of w",
          "        repeat with s in sessions of t",
          "          if (unique ID of s) is targetId then",
          "            tell s to write text msg",
          "            return",
          "          end if",
          "        end repeat",
          "      end repeat",
          "    end repeat",
          "  end tell",
          '  error "session not found"',
          "end run",
        ].join("\n");
        await run("osascript", ["-e", script, transport.sessionUuid, line]);
        return true;
      }
      case "file":
        fs.appendFileSync(transport.file, line + "\n");
        return true;
      case "none":
        return false;
    }
  } catch {
    return false;
  }
}

/** Best-effort desktop notification (macOS). Never throws. */
export function notify(message: string): void {
  execFile(
    "osascript",
    ["-e", "on run argv", "-e", 'display notification (item 1 of argv) with title "nitpic"', "-e", "end run", message],
    { timeout: 5000 },
    () => {},
  );
}
