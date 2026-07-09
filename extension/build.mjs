import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "fs";

mkdirSync("dist", { recursive: true });

await esbuild.build({
  entryPoints: [
    "src/background.ts",
    "src/content.ts",
    "src/offscreen.ts",
    "src/options.ts",
    "src/welcome.ts",
  ],
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "chrome116",
  logLevel: "info",
  loader: { ".svg": "text", ".png": "dataurl" },
});

cpSync("public", "dist", { recursive: true });

// Inline the brand SVGs into the welcome page (theme-aware via CSS classes).
const welcome = readFileSync("dist/welcome.html", "utf8")
  .replace("<!--LOGO-->", readFileSync("src/logo.svg", "utf8"))
  .replace("<!--MASCOT-->", readFileSync("src/mascot.svg", "utf8"));
writeFileSync("dist/welcome.html", welcome);

console.log("extension built → extension/dist (load this dir as unpacked)");
