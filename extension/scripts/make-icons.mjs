/**
 * Generate the nitpic icon set (gradient rounded square + four-point sparkle)
 * as PNGs with zero dependencies — raw PNG encoding via node:zlib.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../public/icons/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

/* ---------- tiny PNG encoder ---------- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- drawing: brand green square + black cursor + click ticks ---------- */

const GREEN = [0x91, 0xc3, 0x1c];
const BLACK = [0x14, 0x14, 0x10];

// Classic pointer, tip at upper-left, tail toward lower-right.
const CURSOR = [
  [0.32, 0.2],
  [0.32, 0.78],
  [0.47, 0.63],
  [0.56, 0.85],
  [0.65, 0.81],
  [0.56, 0.6],
  [0.76, 0.6],
];

function inPolygon(u, v, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// White "click" ticks near the cursor tip, like the logo.
const TICKS = [
  { a: [0.22, 0.1], b: [0.27, 0.16] },
  { a: [0.12, 0.24], b: [0.19, 0.27] },
];

function nearSegment(u, v, { a, b }, w) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(u - (a[0] + t * dx), v - (a[1] + t * dy)) <= w;
}

/** Coverage of the rounded-square background at normalized point (u,v in 0..1). */
function roundedRect(u, v, radius) {
  const x = Math.abs(u - 0.5) - (0.5 - radius);
  const y = Math.abs(v - 0.5) - (0.5 - radius);
  if (x <= 0 && y <= 0) return 1;
  const d = Math.hypot(Math.max(x, 0), Math.max(y, 0));
  return d <= radius ? 1 : 0;
}

function render(size) {
  const SS = 4; // supersampling
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let cursor = 0;
      let tick = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          bg += roundedRect(u, v, 0.22);
          if (inPolygon(u, v, CURSOR)) cursor++;
          else if (TICKS.some((s) => nearSegment(u, v, s, 0.024))) tick++;
        }
      }
      bg /= SS * SS;
      cursor /= SS * SS;
      tick /= SS * SS;
      const i = (py * size + px) * 4;
      // green base → black cursor → white ticks
      rgba[i] = Math.round(GREEN[0] * (1 - cursor - tick) + BLACK[0] * cursor + 255 * tick);
      rgba[i + 1] = Math.round(GREEN[1] * (1 - cursor - tick) + BLACK[1] * cursor + 255 * tick);
      rgba[i + 2] = Math.round(GREEN[2] * (1 - cursor - tick) + BLACK[2] * cursor + 255 * tick);
      rgba[i + 3] = Math.round(bg * 255);
    }
  }
  return encodePng(size, rgba);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(`${OUT}icon${size}.png`, render(size));
  console.log(`icons/icon${size}.png`);
}
