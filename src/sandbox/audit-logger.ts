import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type AuditEntry = {
  timestamp: string;
  operation: "read" | "write" | "edit" | "list" | "exec";
  targetPath: string;
  resolvedPath: string;
  allowed: boolean;
  reason: string;
  sessionId?: string;
  model?: string;
};

const AUDIT_LOG_PATH = path.join(os.homedir(), ".officeclaw", "audit.jsonl");

export function logAudit(entry: AuditEntry): void {
  const dir = path.dirname(AUDIT_LOG_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(AUDIT_LOG_PATH, line);
}

export function readAuditLog(opts?: { deniedOnly?: boolean; limit?: number }): AuditEntry[] {
  if (!fs.existsSync(AUDIT_LOG_PATH)) return [];

  const lines = fs.readFileSync(AUDIT_LOG_PATH, "utf-8").trim().split("\n").filter(Boolean);
  let entries = lines.map((l) => JSON.parse(l) as AuditEntry);

  if (opts?.deniedOnly) {
    entries = entries.filter((e) => !e.allowed);
  }

  if (opts?.limit) {
    entries = entries.slice(-opts.limit);
  }

  return entries;
}

export function getAuditLogPath(): string {
  return AUDIT_LOG_PATH;
}
