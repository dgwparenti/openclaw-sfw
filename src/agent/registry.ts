import fs from "node:fs";
import path from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  type AgentSessionEventListener,
} from "@mariozechner/pi-coding-agent";
import { getModel, type Model } from "@mariozechner/pi-ai";
import type { AgentDefinition, SandboxConfig, AppConfig } from "../config/schema.js";
import { resolveAgentDir, resolveHomePath, resolveSkillsDir } from "../config/loader.js";
import { createPathValidator } from "../sandbox/path-validator.js";
import { createSandboxedTools } from "../sandbox/tools.js";
import type { ConfirmationGate } from "../sandbox/confirmation.js";
import {
  ensureAgentWorkspace,
  ensureAllAgentWorkspaces,
  loadBootFiles,
  buildSystemPrompt,
  buildSandboxInfoPrompt,
  buildAgentListInfo,
} from "./workspace.js";
import { loadAllSkillsForAgent, formatSkillsForPrompt, ensureDefaultSkills } from "./skills.js";

export type ManagedAgent = {
  id: string;
  config: AgentDefinition;
  session: AgentSession;
  agentDir: string;
};

export class AgentRegistry {
  private agents = new Map<string, ManagedAgent>();

  async initAgent(
    agentDef: AgentDefinition,
    opts: {
      appConfig: AppConfig;
      customTools?: any[];
      confirmationGate?: ConfirmationGate;
    },
  ): Promise<ManagedAgent> {
    const agentDir = ensureAgentWorkspace(agentDef.id);
    const sessionsDir = path.join(agentDir, "sessions");
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Configure provider env
    configureProviderEnv(agentDef, opts.appConfig);

    // Resolve model
    const model = resolveModelForAgent(agentDef, opts.appConfig);

    // Create sandbox tools (shared sandbox config)
    const validator = createPathValidator(opts.appConfig.sandbox, agentDir);
    const sandboxedTools = createSandboxedTools(agentDir, validator, {
      confirmationGate:
        opts.appConfig.sandbox.confirmWrites ? opts.confirmationGate : undefined,
    });

    // Load skills
    const skillsDir = resolveSkillsDir(opts.appConfig);
    ensureDefaultSkills(skillsDir);
    const skills = loadAllSkillsForAgent(skillsDir, agentDir, agentDef.skills.map(resolveHomePath));

    // Build system prompt from boot files
    const bootFiles = loadBootFiles(agentDir);
    const sandboxInfo = buildSandboxInfoPrompt(
      opts.appConfig.sandbox.read.map(resolveHomePath),
      opts.appConfig.sandbox.readWrite.map(resolveHomePath),
      opts.appConfig.sandbox.deny,
    );
    const agentListInfo = agentDef.isCoordinator
      ? buildAgentListInfo(opts.appConfig.agents)
      : undefined;

    let systemPrompt = buildSystemPrompt(bootFiles, sandboxInfo, agentListInfo);

    // Append skills to system prompt
    if (skills.length > 0) {
      systemPrompt += "\n\n" + formatSkillsForPrompt(skills);
    }

    // Create resource loader with our system prompt
    const resourceLoader = new DefaultResourceLoader({
      cwd: agentDir,
      systemPromptOverride: () => systemPrompt,
      appendSystemPromptOverride: () => [],
      noExtensions: true,
      noSkills: true, // We already loaded skills into systemPrompt
    });
    await resourceLoader.reload();

    // Create session
    const sessionManager = SessionManager.continueRecent(agentDir, sessionsDir);

    const { session } = await createAgentSession({
      cwd: agentDir,
      model,
      tools: sandboxedTools,
      customTools: opts.customTools,
      sessionManager,
      resourceLoader,
      thinkingLevel: "low",
    });

    const managed: ManagedAgent = { id: agentDef.id, config: agentDef, session, agentDir };
    this.agents.set(agentDef.id, managed);
    return managed;
  }

  getAgent(id: string): ManagedAgent | undefined {
    return this.agents.get(id);
  }

  listAgents(): ManagedAgent[] {
    return Array.from(this.agents.values()).filter((a) => !a.config.isCoordinator);
  }

  listAllAgents(): ManagedAgent[] {
    return Array.from(this.agents.values());
  }

  async sendToAgent(agentId: string, message: string): Promise<string> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent "${agentId}" not found`);

    // Collect the response text
    let responseText = "";
    const unsub = agent.session.subscribe((event: AgentSessionEvent) => {
      if (event.type === "message_update") {
        const ame = (event as any).assistantMessageEvent;
        if (ame?.type === "text_delta") {
          responseText += ame.delta;
        }
      }
    });

    try {
      await agent.session.prompt(message);
    } finally {
      unsub();
    }

    return responseText || "(No response from agent)";
  }

  disposeAll(): void {
    for (const agent of this.agents.values()) {
      agent.session.dispose();
    }
    this.agents.clear();
  }
}

function configureProviderEnv(agentDef: AgentDefinition, config: AppConfig): void {
  const provider = agentDef.provider;
  if (provider === "anthropic" && config.providers.anthropic?.apiKey) {
    process.env.ANTHROPIC_API_KEY = config.providers.anthropic.apiKey;
  }
  if (provider === "openai" && config.providers.openai?.apiKey) {
    process.env.OPENAI_API_KEY = config.providers.openai.apiKey;
  }
  if (provider === "ollama") {
    if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = "ollama";
    if (config.providers.ollama?.baseURL) {
      process.env.OPENAI_BASE_URL = config.providers.ollama.baseURL;
    }
  }
}

function resolveModelForAgent(agentDef: AgentDefinition, appConfig: AppConfig) {
  if (agentDef.provider === "ollama") {
    const baseUrl = appConfig.providers.ollama?.baseURL ?? "http://localhost:11434/v1";
    const model: Model<"openai-completions"> = {
      id: agentDef.model,
      name: `${agentDef.model} (Ollama)`,
      api: "openai-completions",
      provider: "openai",
      baseUrl,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 32000,
      compat: {
        supportsDeveloperRole: false,
        supportsReasoningEffort: false,
      },
    };
    return model;
  }

  try {
    return getModel(agentDef.provider as any, agentDef.model as any);
  } catch {
    if (agentDef.provider === "anthropic") return getModel("anthropic", "claude-sonnet-4-20250514");
    return getModel("openai", "gpt-4o" as any);
  }
}
