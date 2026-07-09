import * as esbuild from "esbuild";
import { chmodSync, mkdirSync } from "fs";

// Bundle the daemon and ctl into single self-contained files inside the
// plugin, so installing the plugin needs no npm install step.
mkdirSync("../plugin/dist", { recursive: true });

await esbuild.build({
  entryPoints: { daemon: "src/cli.ts", ctl: "src/ctl.ts" },
  bundle: true,
  outdir: "../plugin/dist",
  platform: "node",
  format: "cjs",
  target: "node18",
  logLevel: "info",
});

chmodSync("../plugin/dist/daemon.js", 0o755);
chmodSync("../plugin/dist/ctl.js", 0o755);
console.log("daemon + ctl bundled → plugin/dist");
