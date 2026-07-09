import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FeedbackItem } from "@nitpic/shared";
import { ensureGitignored, writeAssets, MAX_HTML_BYTES } from "../src/assets";

let project: string;

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), "nitpic-project-"));
});

afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true });
});

// 1x1 transparent PNG
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function item(over: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: "it-1",
    kind: "element",
    url: "http://localhost:3000/",
    comment: "fix it",
    selector: "button.x",
    rect: { x: 0, y: 0, width: 10, height: 10 },
    viewport: { width: 1440, height: 900 },
    createdAt: "2026-07-07T12:00:00.000Z",
    ...over,
  };
}

describe("writeAssets", () => {
  it("writes screenshot and html into .feedback/ with relative paths", () => {
    const stored = writeAssets(
      project,
      item({ html: "<button class=\"x\">Save</button>", screenshot: `data:image/png;base64,${PNG_B64}` }),
    );
    expect(stored.htmlPath).toMatch(/^\.feedback\/fb-.*\.html$/);
    expect(stored.screenshotPath).toMatch(/^\.feedback\/fb-.*\.png$/);
    expect(fs.readFileSync(path.join(project, stored.htmlPath!), "utf8")).toContain("Save");
    const png = fs.readFileSync(path.join(project, stored.screenshotPath!));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });

  it("truncates oversized HTML and flags it", () => {
    const big = "<div>" + "x".repeat(MAX_HTML_BYTES * 2) + "</div>";
    const stored = writeAssets(project, item({ html: big }));
    expect(stored.htmlTruncated).toBe(true);
    const written = fs.readFileSync(path.join(project, stored.htmlPath!), "utf8");
    expect(Buffer.byteLength(written)).toBeLessThan(MAX_HTML_BYTES + 100);
    expect(written).toContain("truncated by nitpic");
  });

  it("flags an unparsable screenshot instead of failing", () => {
    const stored = writeAssets(project, item({ screenshot: "data:image/gif;base64,zzz" }));
    expect(stored.screenshotPath).toBeUndefined();
    expect(stored.screenshotFailed).toBe(true);
  });
});

describe("ensureGitignored", () => {
  it("appends .feedback/ to an existing .gitignore once", () => {
    fs.writeFileSync(path.join(project, ".gitignore"), "node_modules/\n");
    ensureGitignored(project);
    ensureGitignored(project);
    const content = fs.readFileSync(path.join(project, ".gitignore"), "utf8");
    expect(content.match(/\.feedback\//g)).toHaveLength(1);
  });

  it("does not create a .gitignore where none exists", () => {
    ensureGitignored(project);
    expect(fs.existsSync(path.join(project, ".gitignore"))).toBe(false);
  });
});
