import {
  createReadTool,
  createWriteTool,
  createEditTool,
  createBashTool,
  createLsTool,
  createFindTool,
  createGrepTool,
} from "@mariozechner/pi-coding-agent";
import type { PathValidator } from "./path-validator.js";
import type { ConfirmationGate } from "./confirmation.js";
import { logAudit } from "./audit-logger.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

type SandboxWrapOptions = {
  validator: PathValidator;
  operation: "read" | "write" | "edit" | "list" | "exec";
  getPath: (input: any) => string | undefined;
  cwd: string;
  confirmationGate?: ConfirmationGate;
};

function wrapToolWithSandbox(tool: any, opts: SandboxWrapOptions): any {
  const { validator, operation, getPath, cwd, confirmationGate } = opts;
  const originalExecute = tool.execute;

  return {
    ...tool,
    execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any) => {
      const filePath = getPath(params);
      if (filePath) {
        const validate =
          operation === "read" || operation === "list"
            ? validator.validateRead
            : validator.validateWrite;
        const result = validate(filePath, cwd);

        logAudit({
          timestamp: new Date().toISOString(),
          operation,
          targetPath: filePath,
          resolvedPath: result.resolvedPath,
          allowed: result.allowed,
          reason: result.reason,
        });

        if (!result.allowed) {
          return {
            content: [{ type: "text" as const, text: `Access denied: ${result.reason}` }],
          };
        }

        if (operation === "read") {
          const sizeCheck = validator.checkFileSize(result.resolvedPath);
          if (!sizeCheck.ok) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `File too large (${sizeCheck.sizeMB.toFixed(1)} MB). Max allowed: configured limit.`,
                },
              ],
            };
          }
        }

        // Write confirmation gate
        if (
          (operation === "write" || operation === "edit") &&
          confirmationGate &&
          !validator.shouldAutoApprove(result.resolvedPath)
        ) {
          const approved = await confirmationGate(result.resolvedPath, operation, params);
          if (!approved) {
            logAudit({
              timestamp: new Date().toISOString(),
              operation,
              targetPath: filePath,
              resolvedPath: result.resolvedPath,
              allowed: false,
              reason: "User denied write confirmation",
            });
            return {
              content: [
                {
                  type: "text" as const,
                  text: `User denied ${operation} access to ${filePath}`,
                },
              ],
            };
          }
        }
      }

      return originalExecute(toolCallId, params, signal, onUpdate);
    },
  };
}

export type CreateSandboxedToolsOptions = {
  confirmationGate?: ConfirmationGate;
};

export function createSandboxedTools(
  workspaceDir: string,
  validator: PathValidator,
  options?: CreateSandboxedToolsOptions,
): any[] {
  const cwd = workspaceDir;
  const gate = options?.confirmationGate;

  return [
    wrapToolWithSandbox(createReadTool(cwd), {
      validator,
      operation: "read",
      getPath: (p: any) => p.path,
      cwd,
    }),
    wrapToolWithSandbox(createWriteTool(cwd), {
      validator,
      operation: "write",
      getPath: (p: any) => p.path,
      cwd,
      confirmationGate: gate,
    }),
    wrapToolWithSandbox(createEditTool(cwd), {
      validator,
      operation: "edit",
      getPath: (p: any) => p.path,
      cwd,
      confirmationGate: gate,
    }),
    wrapToolWithSandbox(createLsTool(cwd), {
      validator,
      operation: "list",
      getPath: (p: any) => p.path,
      cwd,
    }),
    wrapToolWithSandbox(createFindTool(cwd), {
      validator,
      operation: "list",
      getPath: (p: any) => p.path,
      cwd,
    }),
    wrapToolWithSandbox(createGrepTool(cwd), {
      validator,
      operation: "read",
      getPath: (p: any) => p.path,
      cwd,
    }),
    wrapToolWithSandbox(createBashTool(workspaceDir), {
      validator,
      operation: "exec",
      getPath: (_p: any) => workspaceDir,
      cwd,
    }),
  ];
}
