import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drain, enqueue, pending } from "../src/queue";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nitpic-test-"));
  process.env.NITPIC_DIR = tmp;
});

afterEach(() => {
  delete process.env.NITPIC_DIR;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("queue", () => {
  const project = "/Users/dev/project-a";

  it("drains in FIFO order and clears the queue", () => {
    enqueue(project, "first");
    enqueue(project, "second");
    expect(pending(project)).toBe(2);
    expect(drain(project)).toEqual(["first", "second"]);
    expect(pending(project)).toBe(0);
    expect(drain(project)).toEqual([]);
  });

  it("keeps projects isolated", () => {
    enqueue(project, "for A");
    enqueue("/Users/dev/project-b", "for B");
    expect(drain(project)).toEqual(["for A"]);
    expect(drain("/Users/dev/project-b")).toEqual(["for B"]);
  });

  it("survives multi-line messages", () => {
    const msg = "[Browser feedback — 1 item]\n\n1. Element: x\n   Comment: \"hi\"\n";
    enqueue(project, msg);
    expect(drain(project)).toEqual([msg]);
  });

  it("skips corrupt lines instead of failing the flush", () => {
    enqueue(project, "good");
    // simulate a partially written line
    const files = fs.readdirSync(path.join(tmp, "queue"));
    fs.appendFileSync(path.join(tmp, "queue", files[0]), "{not json\n");
    enqueue(project, "also good");
    expect(drain(project)).toEqual(["good", "also good"]);
  });
});
