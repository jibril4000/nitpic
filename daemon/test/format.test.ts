import { describe, expect, it } from "vitest";
import { formatMessage, StoredItem } from "../src/format";

function item(over: Partial<StoredItem> = {}): StoredItem {
  return {
    id: "it-1",
    kind: "element",
    url: "https://localhost:3000/settings",
    comment: "Disable this until the form is dirty, and right-align it.",
    selector: "button.save-btn",
    ancestorHint: "form#account-settings",
    rect: { x: 10, y: 20, width: 100, height: 30 },
    viewport: { width: 1440, height: 900 },
    createdAt: "2026-07-07T12:00:00.000Z",
    htmlPath: ".feedback/fb-1.html",
    screenshotPath: ".feedback/fb-1.png",
    ...over,
  };
}

describe("formatMessage", () => {
  it("produces a self-contained single-item message", () => {
    const msg = formatMessage([item()]);
    expect(msg).toContain("[Browser feedback — 1 item — https://localhost:3000/settings — viewport 1440x900]");
    expect(msg).toContain("1. Element: button.save-btn (inside form#account-settings)");
    expect(msg).toContain('Comment: "Disable this until the form is dirty, and right-align it."');
    expect(msg).toContain("HTML snippet: .feedback/fb-1.html");
    expect(msg).toContain("Screenshot: .feedback/fb-1.png");
    expect(msg).toContain("Please read the referenced screenshot/snippet files");
  });

  it("numbers batch items", () => {
    const msg = formatMessage([item(), item({ id: "it-2", selector: "div.sidebar" })]);
    expect(msg).toContain("[Browser feedback — 2 items —");
    expect(msg).toContain("1. Element: button.save-btn");
    expect(msg).toContain("2. Element: div.sidebar");
  });

  it("labels region selections", () => {
    const msg = formatMessage([
      item({ kind: "region", selector: ".sidebar-nav", htmlPath: undefined }),
    ]);
    expect(msg).toContain("1. Region selection near .sidebar-nav");
    expect(msg).not.toContain("HTML snippet");
  });

  it("falls back to coordinates for anonymous regions", () => {
    const msg = formatMessage([item({ kind: "region", selector: undefined })]);
    expect(msg).toContain("Region selection at (10,20 100x30)");
  });

  it("groups items under their page when URLs differ", () => {
    const msg = formatMessage([
      item(),
      item({ id: "it-2", url: "https://localhost:3000/home", selector: "div.hero" }),
      item({ id: "it-3", selector: "input.email" }),
    ]);
    expect(msg).toContain("2 pages");
    // Same-page items are numbered together under one page heading.
    const settingsIdx = msg.indexOf("Page: https://localhost:3000/settings");
    const homeIdx = msg.indexOf("Page: https://localhost:3000/home");
    expect(settingsIdx).toBeGreaterThan(-1);
    expect(homeIdx).toBeGreaterThan(settingsIdx);
    expect(msg.indexOf("2. Element: input.email")).toBeLessThan(homeIdx);
    expect(msg.indexOf("3. Element: div.hero")).toBeGreaterThan(homeIdx);
  });

  it("notes missing screenshots and truncated HTML", () => {
    const msg = formatMessage([
      item({ screenshotPath: undefined, screenshotFailed: true, htmlTruncated: true }),
    ]);
    expect(msg).toContain("Screenshot: capture failed, none available");
    expect(msg).toContain("HTML snippet: .feedback/fb-1.html (truncated)");
  });

  it("escapes newlines inside comments", () => {
    const msg = formatMessage([item({ comment: "line one\nline two" })]);
    expect(msg).toContain('Comment: "line one\\nline two"');
  });

  it("throws on empty input", () => {
    expect(() => formatMessage([])).toThrow();
  });
});
