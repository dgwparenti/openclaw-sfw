import fs from "node:fs";
import path from "node:path";
// @ts-ignore — picomatch has no declaration file
import picomatch from "picomatch";
import type { SandboxConfig } from "../config/schema.js";
import { resolveHomePath } from "../config/loader.js";

export type ValidationResult = {
  allowed: boolean;
  resolvedPath: string;
  reason: string;
};

export function createPathValidator(config: SandboxConfig, workspaceDir: string) {
  const readDirs = config.read.map(resolveHomePath);
  const readWriteDirs = config.readWrite.map(resolveHomePath);
  const allReadDirs = [...readDirs, ...readWriteDirs, workspaceDir];
  const allWriteDirs = [...readWriteDirs, workspaceDir];
  const denyMatcher = config.deny.length > 0 ? picomatch(config.deny) : () => false;
  const autoApproveMatcher =
    config.autoApprove.length > 0
      ? picomatch(config.autoApprove.map((p) => resolveHomePath(p)))
      : () => false;

  function resolveAndNormalize(filePath: string, cwd: string): string {
    let expanded = filePath;
    if (expanded === "~") expanded = resolveHomePath("~");
    else if (expanded.startsWith("~/")) expanded = resolveHomePath(expanded);
    else if (!path.isAbsolute(expanded)) expanded = path.resolve(cwd, expanded);
    return path.normalize(expanded);
  }

  function resolveRealPath(filePath: string): string {
    try {
      return fs.realpathSync(filePath);
    } catch {
      // File may not exist yet (for writes) — resolve parent
      const dir = path.dirname(filePath);
      try {
        return path.join(fs.realpathSync(dir), path.basename(filePath));
      } catch {
        return filePath;
      }
    }
  }

  function isWithin(resolved: string, dirs: string[]): string | undefined {
    for (const dir of dirs) {
      const normalizedDir = path.normalize(dir) + path.sep;
      if (resolved === path.normalize(dir) || resolved.startsWith(normalizedDir)) {
        return dir;
      }
    }
    return undefined;
  }

  function validateRead(filePath: string, cwd: string): ValidationResult {
    const normalized = resolveAndNormalize(filePath, cwd);
    const resolved = resolveRealPath(normalized);

    if (denyMatcher(resolved) || denyMatcher(path.basename(resolved))) {
      return { allowed: false, resolvedPath: resolved, reason: `Denied by pattern: ${filePath}` };
    }

    const withinDir = isWithin(resolved, allReadDirs);
    if (withinDir) {
      return {
        allowed: true,
        resolvedPath: resolved,
        reason: `Within approved read directory: ${withinDir}`,
      };
    }

    return {
      allowed: false,
      resolvedPath: resolved,
      reason: `Path not within any approved directory. Use "officeclaw sandbox add <dir>" to grant access.`,
    };
  }

  function validateWrite(filePath: string, cwd: string): ValidationResult {
    const normalized = resolveAndNormalize(filePath, cwd);
    const resolved = resolveRealPath(normalized);

    if (denyMatcher(resolved) || denyMatcher(path.basename(resolved))) {
      return { allowed: false, resolvedPath: resolved, reason: `Denied by pattern: ${filePath}` };
    }

    const withinDir = isWithin(resolved, allWriteDirs);
    if (withinDir) {
      return {
        allowed: true,
        resolvedPath: resolved,
        reason: `Within approved write directory: ${withinDir}`,
      };
    }

    // Check if it's in a read-only dir
    const readOnlyDir = isWithin(resolved, readDirs);
    if (readOnlyDir) {
      return {
        allowed: false,
        resolvedPath: resolved,
        reason: `Path is in read-only directory: ${readOnlyDir}. Use "officeclaw sandbox add ${readOnlyDir} --write" for write access.`,
      };
    }

    return {
      allowed: false,
      resolvedPath: resolved,
      reason: `Path not within any approved directory. Use "officeclaw sandbox add <dir> --write" to grant access.`,
    };
  }

  function shouldAutoApprove(resolvedPath: string): boolean {
    if (isWithin(resolvedPath, [workspaceDir])) return true;
    return autoApproveMatcher(resolvedPath);
  }

  function checkFileSize(filePath: string): { ok: boolean; sizeMB: number } {
    try {
      const stat = fs.statSync(filePath);
      const sizeMB = stat.size / (1024 * 1024);
      return { ok: sizeMB <= config.maxFileSizeMB, sizeMB };
    } catch {
      return { ok: true, sizeMB: 0 }; // File doesn't exist yet
    }
  }

  return {
    validateRead,
    validateWrite,
    shouldAutoApprove,
    checkFileSize,
    resolveAndNormalize,
  };
}

export type PathValidator = ReturnType<typeof createPathValidator>;
