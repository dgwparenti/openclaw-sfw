import { z } from "zod";

export const SandboxConfigSchema = z.object({
  read: z.array(z.string()).default([]),
  readWrite: z.array(z.string()).default([]),
  deny: z
    .array(z.string())
    .default(["**/.env", "**/.env.*", "**/node_modules/**", "**/.git/**", "**/*.pem", "**/*.key"]),
  confirmWrites: z.boolean().default(true),
  auditLog: z.boolean().default(true),
  maxFileSizeMB: z.number().default(10),
  autoApprove: z.array(z.string()).default([]),
});

export const ProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
});

export const AgentDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  provider: z.enum(["anthropic", "openai", "ollama"]).default("anthropic"),
  model: z.string().default("claude-sonnet-4-20250514"),
  skills: z.array(z.string()).default([]),
  isCoordinator: z.boolean().default(false),
});

const DEFAULT_AGENTS: AgentDefinition[] = [
  { id: "coordinator", name: "Coordinator", provider: "anthropic", model: "claude-sonnet-4-20250514", skills: [], isCoordinator: true },
  { id: "researcher", name: "Researcher", provider: "anthropic", model: "claude-sonnet-4-20250514", skills: [], isCoordinator: false },
  { id: "coder", name: "Coder", provider: "anthropic", model: "claude-sonnet-4-20250514", skills: [], isCoordinator: false },
  { id: "writer", name: "Writer", provider: "anthropic", model: "claude-sonnet-4-20250514", skills: [], isCoordinator: false },
];

export const AppConfigSchema = z.object({
  providers: z
    .object({
      anthropic: ProviderConfigSchema.optional(),
      openai: ProviderConfigSchema.optional(),
      ollama: ProviderConfigSchema.optional(),
    })
    .default({}),
  agents: z.array(AgentDefinitionSchema).default(DEFAULT_AGENTS),
  defaultAgent: z.string().default("coordinator"),
  skillsDir: z.string().default("~/.openclaw/skills"),
  sandbox: SandboxConfigSchema.default({
    read: [],
    readWrite: [],
    deny: ["**/.env", "**/.env.*", "**/node_modules/**", "**/.git/**", "**/*.pem", "**/*.key"],
    confirmWrites: true,
    auditLog: true,
    maxFileSizeMB: 10,
    autoApprove: [],
  }),
});

export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
