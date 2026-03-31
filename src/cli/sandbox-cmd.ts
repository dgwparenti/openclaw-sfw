import { loadConfig, saveConfig, resolveHomePath } from "../config/loader.js";
import { createPathValidator } from "../sandbox/path-validator.js";
import { readAuditLog, getAuditLogPath } from "../sandbox/audit-logger.js";

export function runSandboxCommand(args: string[]): void {
  const subcommand = args[0];

  switch (subcommand) {
    case "list":
      listDirectories();
      break;
    case "add":
      addDirectory(args.slice(1));
      break;
    case "remove":
      removeDirectory(args.slice(1));
      break;
    case "test":
      testPath(args.slice(1));
      break;
    case "log":
      showLog(args.slice(1));
      break;
    case "deny":
      addDenyPattern(args.slice(1));
      break;
    case "reset":
      resetSandbox();
      break;
    default:
      console.log(`Usage: openclaw sandbox <list|add|remove|test|log|deny|reset>`);
      console.log("");
      console.log("  list                       Show approved directories");
      console.log("  add <path> [--write]        Add a read (or read-write) directory");
      console.log("  remove <path>              Revoke access to a directory");
      console.log("  test <path>                Check if a path is accessible");
      console.log("  log [--denied] [--limit N] View audit log");
      console.log("  deny <glob>                Add a deny pattern");
      console.log("  reset                      Remove all approved directories");
  }
}

function listDirectories(): void {
  const config = loadConfig();
  const { sandbox } = config;

  console.log("Sandbox Configuration:\n");

  if (sandbox.read.length === 0 && sandbox.readWrite.length === 0) {
    console.log("  No approved directories. Only agent workspaces are accessible.");
  } else {
    if (sandbox.read.length > 0) {
      console.log("  Read-only:");
      for (const d of sandbox.read) console.log(`    - ${d}`);
    }
    if (sandbox.readWrite.length > 0) {
      console.log("  Read & Write:");
      for (const d of sandbox.readWrite) console.log(`    - ${d}`);
    }
  }

  if (sandbox.deny.length > 0) {
    console.log("\n  Denied patterns:");
    for (const p of sandbox.deny) console.log(`    - ${p}`);
  }

  console.log(`\n  Write confirmation: ${sandbox.confirmWrites ? "enabled" : "disabled"}`);
  console.log(`  Audit log: ${sandbox.auditLog ? "enabled" : "disabled"}`);
  console.log(`  Max file size: ${sandbox.maxFileSizeMB} MB`);
}

function addDirectory(args: string[]): void {
  const isWrite = args.includes("--write");
  const dirPath = args.find((a) => !a.startsWith("--"));

  if (!dirPath) {
    console.error("Usage: openclaw sandbox add <path> [--write]");
    return;
  }

  const config = loadConfig();
  const resolved = resolveHomePath(dirPath);

  if (isWrite) {
    if (!config.sandbox.readWrite.includes(dirPath)) {
      config.sandbox.readWrite.push(dirPath);
    }
    // Remove from read-only if present
    config.sandbox.read = config.sandbox.read.filter((d) => resolveHomePath(d) !== resolved);
  } else {
    if (!config.sandbox.read.includes(dirPath)) {
      config.sandbox.read.push(dirPath);
    }
  }

  saveConfig(config);
  console.log(`Added ${isWrite ? "read-write" : "read-only"} access: ${dirPath}`);
}

function removeDirectory(args: string[]): void {
  const dirPath = args[0];
  if (!dirPath) {
    console.error("Usage: openclaw sandbox remove <path>");
    return;
  }

  const config = loadConfig();
  const resolved = resolveHomePath(dirPath);

  config.sandbox.read = config.sandbox.read.filter((d) => resolveHomePath(d) !== resolved);
  config.sandbox.readWrite = config.sandbox.readWrite.filter((d) => resolveHomePath(d) !== resolved);

  saveConfig(config);
  console.log(`Removed access: ${dirPath}`);
}

function testPath(args: string[]): void {
  const testFilePath = args[0];
  if (!testFilePath) {
    console.error("Usage: openclaw sandbox test <path>");
    return;
  }

  const config = loadConfig();
  const defaultAgentId = config.defaultAgent ?? config.agents[0]?.id ?? "coordinator";
  const validator = createPathValidator(config.sandbox, resolveHomePath(`~/.openclaw/agents/${defaultAgentId}`));

  const readResult = validator.validateRead(testFilePath, process.cwd());
  const writeResult = validator.validateWrite(testFilePath, process.cwd());

  console.log(`Path: ${testFilePath}`);
  console.log(`Resolved: ${readResult.resolvedPath}`);
  console.log(`Read:  ${readResult.allowed ? "ALLOWED" : "DENIED"} — ${readResult.reason}`);
  console.log(`Write: ${writeResult.allowed ? "ALLOWED" : "DENIED"} — ${writeResult.reason}`);
}

function showLog(args: string[]): void {
  const deniedOnly = args.includes("--denied");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] || "50", 10) : 50;

  const entries = readAuditLog({ deniedOnly, limit });

  if (entries.length === 0) {
    console.log("No audit log entries found.");
    console.log(`Log path: ${getAuditLogPath()}`);
    return;
  }

  for (const entry of entries) {
    const status = entry.allowed ? "ALLOWED" : "DENIED ";
    console.log(`[${entry.timestamp}] ${status} ${entry.operation.padEnd(5)} ${entry.targetPath}`);
    if (!entry.allowed) {
      console.log(`  Reason: ${entry.reason}`);
    }
  }
}

function addDenyPattern(args: string[]): void {
  const pattern = args[0];
  if (!pattern) {
    console.error("Usage: openclaw sandbox deny <glob>");
    return;
  }

  const config = loadConfig();
  if (!config.sandbox.deny.includes(pattern)) {
    config.sandbox.deny.push(pattern);
  }
  saveConfig(config);
  console.log(`Added deny pattern: ${pattern}`);
}

function resetSandbox(): void {
  const config = loadConfig();
  config.sandbox.read = [];
  config.sandbox.readWrite = [];
  saveConfig(config);
  console.log("All approved directories removed. Only the workspace is accessible.");
}
