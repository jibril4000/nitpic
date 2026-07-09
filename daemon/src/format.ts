import type { FeedbackItem } from "@nitpic/shared";

/** A feedback item after its assets have been written into the project. */
export interface StoredItem
  extends Omit<FeedbackItem, "html" | "screenshot"> {
  /** Project-relative path, e.g. ".feedback/fb-20260707-0001.html" */
  htmlPath?: string;
  /** Project-relative path, e.g. ".feedback/fb-20260707-0001.png" */
  screenshotPath?: string;
}

/**
 * Build the self-contained message injected into the Claude Code session.
 * Items are grouped under their page URL so multi-page batches read as
 * "this page: these comments" rather than a flat list.
 */
export function formatMessage(items: StoredItem[]): string {
  if (items.length === 0) throw new Error("formatMessage: no items");

  const vp = items[0].viewport;
  const sameViewport = items.every(
    (i) => i.viewport.width === vp.width && i.viewport.height === vp.height,
  );

  // Group by page, preserving the order pages first appear.
  const pages = new Map<string, StoredItem[]>();
  for (const item of items) {
    const group = pages.get(item.url) ?? [];
    group.push(item);
    pages.set(item.url, group);
  }

  const headerParts = [
    `Browser feedback`,
    `${items.length} item${items.length === 1 ? "" : "s"}`,
    pages.size === 1 ? items[0].url : `${pages.size} pages`,
  ];
  if (sameViewport) headerParts.push(`viewport ${vp.width}x${vp.height}`);
  const lines: string[] = [`[${headerParts.join(" — ")}]`, ""];

  let n = 0;
  for (const [url, group] of pages) {
    if (pages.size > 1) lines.push(`Page: ${url}`, "");
    for (const item of group) {
      n++;
      if (item.kind === "element" && item.selector) {
        const anchor = item.ancestorHint ? ` (inside ${item.ancestorHint})` : "";
        lines.push(`${n}. Element: ${item.selector}${anchor}`);
      } else {
        const near = item.selector
          ? ` near ${item.selector}`
          : ` at (${Math.round(item.rect.x)},${Math.round(item.rect.y)} ${Math.round(item.rect.width)}x${Math.round(item.rect.height)})`;
        lines.push(`${n}. Region selection${near}`);
      }
      if (!sameViewport)
        lines.push(`   Viewport: ${item.viewport.width}x${item.viewport.height}`);
      lines.push(`   Comment: ${JSON.stringify(item.comment)}`);
      if (item.htmlPath) {
        const note = item.htmlTruncated ? " (truncated)" : "";
        lines.push(`   HTML snippet: ${item.htmlPath}${note}`);
      }
      if (item.screenshotPath) {
        lines.push(`   Screenshot: ${item.screenshotPath}`);
      } else if (item.screenshotFailed) {
        lines.push(`   Screenshot: capture failed, none available`);
      }
      lines.push("");
    }
  }

  lines.push(
    "Please read the referenced screenshot/snippet files for full context, then address each item.",
  );
  return lines.join("\n");
}

/**
 * The single line typed into the terminal. Deliberately contains no user
 * content (comments live in the message file), so it is safe to inject
 * through any transport without escaping concerns.
 */
export function pointerLine(messagePath: string, itemCount: number): string {
  const items = `${itemCount} item${itemCount === 1 ? "" : "s"}`;
  return `New browser feedback (${items}) — please read ${messagePath} and address each item.`;
}
