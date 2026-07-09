import * as crypto from "crypto";
import * as fs from "fs";
import { configPath, ensureDir, nitpicDir } from "./paths";

export interface Config {
  port: number;
  token: string;
  /** True once an extension has completed a hello successfully. */
  paired: boolean;
}

export const DEFAULT_PORT = 8790;

export function loadConfig(): Config {
  ensureDir(nitpicDir());
  const file = configPath();
  if (!fs.existsSync(file)) {
    const fresh: Config = {
      port: DEFAULT_PORT,
      token: crypto.randomBytes(16).toString("hex"),
      paired: false,
    };
    saveConfig(fresh);
    return fresh;
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    port: typeof raw.port === "number" ? raw.port : DEFAULT_PORT,
    token:
      typeof raw.token === "string" && raw.token.length > 0
        ? raw.token
        : crypto.randomBytes(16).toString("hex"),
    paired: raw.paired === true,
  };
}

export function saveConfig(cfg: Config): void {
  ensureDir(nitpicDir());
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + "\n");
}
