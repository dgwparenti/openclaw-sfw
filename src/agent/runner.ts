import type { AgentSessionEventListener } from "@mariozechner/pi-coding-agent";
import type { AppConfig } from "../config/schema.js";
import type { ConfirmationGate } from "../sandbox/confirmation.js";
import { AgentRegistry, type ManagedAgent } from "./registry.js";
import { ensureAllAgentWorkspaces } from "./workspace.js";
import { createDelegateToAgentTool, createListAgentsTool } from "./delegate-tool.js";

export type AgentRunnerOptions = {
  config: AppConfig;
  confirmationGate?: ConfirmationGate;
};

export async function createAgentRunner(options: AgentRunnerOptions) {
  const { config, confirmationGate } = options;

  // Ensure all agent workspaces exist
  ensureAllAgentWorkspaces(config);

  // Create the registry
  const registry = new AgentRegistry();

  // Initialize non-coordinator agents first (so the coordinator can reference them)
  const nonCoordinators = config.agents.filter((a) => !a.isCoordinator);
  for (const agentDef of nonCoordinators) {
    await registry.initAgent(agentDef, { appConfig: config, confirmationGate });
  }

  // Initialize coordinator agents with delegation tools
  const coordinators = config.agents.filter((a) => a.isCoordinator);
  for (const agentDef of coordinators) {
    const customTools = [
      createDelegateToAgentTool(registry),
      createListAgentsTool(registry),
    ];
    await registry.initAgent(agentDef, { appConfig: config, customTools, confirmationGate });
  }

  // Active agent = the default agent
  let activeAgent = registry.getAgent(config.defaultAgent) ?? registry.listAllAgents()[0];
  if (!activeAgent) throw new Error("No agents configured");

  // Track the current unsubscribe function
  let currentUnsub: (() => void) | undefined;

  return {
    registry,

    get activeAgent(): ManagedAgent {
      return activeAgent;
    },

    get activeAgentId(): string {
      return activeAgent.id;
    },

    subscribe(listener: AgentSessionEventListener): () => void {
      currentUnsub?.();
      currentUnsub = activeAgent.session.subscribe(listener);
      return currentUnsub;
    },

    switchAgent(agentId: string): boolean {
      const agent = registry.getAgent(agentId) ?? registry.listAllAgents().find((a) => a.id === agentId);
      if (!agent) return false;
      activeAgent = agent;
      return true;
    },

    async sendMessage(message: string): Promise<void> {
      await activeAgent.session.prompt(message);
    },

    async newSession(): Promise<void> {
      await activeAgent.session.newSession();
    },

    dispose(): void {
      currentUnsub?.();
      registry.disposeAll();
    },
  };
}

export type AgentRunner = Awaited<ReturnType<typeof createAgentRunner>>;
