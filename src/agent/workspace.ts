import fs from "node:fs";
import path from "node:path";
import type { AppConfig, AgentDefinition } from "../config/schema.js";
import { resolveAgentDir } from "../config/loader.js";
import { getSoulTemplate } from "./templates.js";

const BOOT_FILES = [
  "SOUL.md",
  "MEMORY.md",
  "HEARTBEAT.md",
  "AGENTS.md",
  "USER.md",
  "IDENTITY.md",
  "TOOLS.md",
  "BOOTSTRAP.md",
] as const;

export type BootFileName = (typeof BOOT_FILES)[number];

const DEFAULT_MEMORY = `# Memory

This file stores your persistent memory across sessions. Update it when you learn important things.
`;

const DEFAULT_HEARTBEAT = `# Heartbeat

Define scheduled tasks here. Each task has a schedule and a description.

## Tasks

<!-- Example:
### Daily Summary
- Schedule: daily at 9:00 AM
- Task: Review recent memory entries and summarize key updates
-->
`;

export function ensureAgentWorkspace(agentId: string): string {
  const agentDir = resolveAgentDir(agentId);
  fs.mkdirSync(agentDir, { recursive: true });
  fs.mkdirSync(path.join(agentDir, "sessions"), { recursive: true });
  fs.mkdirSync(path.join(agentDir, "skills"), { recursive: true });

  for (const file of BOOT_FILES) {
    const filePath = path.join(agentDir, file);
    if (!fs.existsSync(filePath)) {
      let content: string;
      if (file === "SOUL.md") {
        content = getSoulTemplate(agentId);
      } else if (file === "MEMORY.md") {
        content = DEFAULT_MEMORY;
      } else if (file === "HEARTBEAT.md") {
        content = DEFAULT_HEARTBEAT;
      } else {
        content = `# ${file.replace(".md", "")}\n`;
      }
      fs.writeFileSync(filePath, content);
    }
  }

  return agentDir;
}

export function ensureAllAgentWorkspaces(config: AppConfig): void {
  for (const agentDef of config.agents) {
    ensureAgentWorkspace(agentDef.id);
  }
}

export function loadBootFiles(agentDir: string): Map<BootFileName, string> {
  const files = new Map<BootFileName, string>();
  for (const file of BOOT_FILES) {
    const filePath = path.join(agentDir, file);
    if (fs.existsSync(filePath)) {
      files.set(file, fs.readFileSync(filePath, "utf-8"));
    }
  }
  return files;
}

export function buildSystemPrompt(
  bootFiles: Map<BootFileName, string>,
  sandboxInfo: string,
  agentListInfo?: string,
): string {
  const parts: string[] = [];

  const soul = bootFiles.get("SOUL.md");
  if (soul) parts.push(soul);

  if (agentListInfo) parts.push(agentListInfo);

  const identity = bootFiles.get("IDENTITY.md");
  if (identity && identity.trim().length > 2) parts.push(`\n## Identity\n${identity}`);

  const user = bootFiles.get("USER.md");
  if (user && user.trim().length > 2) parts.push(`\n## User Context\n${user}`);

  const agents = bootFiles.get("AGENTS.md");
  if (agents && agents.trim().length > 2) parts.push(`\n## Operational Rules\n${agents}`);

  const tools = bootFiles.get("TOOLS.md");
  if (tools && tools.trim().length > 2) parts.push(`\n## Tool Usage\n${tools}`);

  const heartbeat = bootFiles.get("HEARTBEAT.md");
  if (heartbeat && heartbeat.trim().length > 2) parts.push(`\n## Scheduled Tasks\n${heartbeat}`);

  const memory = bootFiles.get("MEMORY.md");
  if (memory && memory.trim().length > 2) parts.push(`\n## Persistent Memory\n${memory}`);

  parts.push(`\n${sandboxInfo}`);

  const now = new Date();
  parts.push(
    `\n## Current Time\n${now.toISOString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
  );

  return parts.join("\n");
}

export function buildSandboxInfoPrompt(
  readDirs: string[],
  readWriteDirs: string[],
  denyPatterns: string[],
): string {
  const lines = ["## Your Filesystem Access\n"];

  if (readDirs.length > 0) {
    lines.push("**Read-only:**");
    for (const d of readDirs) lines.push(`- ${d}`);
    lines.push("");
  }

  if (readWriteDirs.length > 0) {
    lines.push("**Read & Write:**");
    for (const d of readWriteDirs) lines.push(`- ${d}`);
    lines.push("");
  }

  if (denyPatterns.length > 0) {
    lines.push("**Denied patterns (never access these):**");
    for (const p of denyPatterns) lines.push(`- ${p}`);
    lines.push("");
  }

  lines.push(
    'If you need access to a directory not listed here, tell the user and ask them to add it via `officeclaw sandbox add <path>`.',
  );

  return lines.join("\n");
}

export function buildAgentListInfo(agents: AgentDefinition[]): string {
  const nonCoordinator = agents.filter((a) => !a.isCoordinator);
  if (nonCoordinator.length === 0) return "";

  const lines = ["## Available Specialist Agents\n"];
  for (const a of nonCoordinator) {
    lines.push(`- **${a.id}**: ${a.name ?? a.id}`);
  }
  lines.push(
    "\nUse the delegate_to_agent tool to send tasks to these agents. Use list_agents for the latest list.",
  );
  return lines.join("\n");
}
