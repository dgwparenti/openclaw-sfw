import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AppConfigSchema, type AppConfig } from "./schema.js";

const CONFIG_DIR = path.join(os.homedir(), ".openclaw");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function resolveHomePath(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return path.resolve(p);
}

export function loadConfig(): AppConfig {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  if (!fs.existsSync(CONFIG_FILE)) {
    const defaults = AppConfigSchema.parse({});
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaults, null, 2) + "\n");
    return defaults;
  }

  const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  return AppConfigSchema.parse(raw);
}

export function saveConfig(config: AppConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

export function resolveAgentDir(agentId: string): string {
  return resolveHomePath(`~/.openclaw/agents/${agentId}`);
}

export function resolveSkillsDir(config: AppConfig): string {
  return resolveHomePath(config.skillsDir);
}
