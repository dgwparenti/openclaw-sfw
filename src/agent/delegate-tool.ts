import { Type } from "@sinclair/typebox";
import type { AgentRegistry } from "./registry.js";

// We use `any` for ToolDefinition to avoid fighting the generic type params
// The Pi SDK accepts these via `customTools` which is typed as ToolDefinition[]

export function createDelegateToAgentTool(registry: AgentRegistry): any {
  return {
    name: "delegate_to_agent",
    label: "Delegate to Agent",
    description:
      "Send a task to a specialist agent and get their response. Use this to delegate work to the right agent based on their expertise.",
    promptSnippet: "Delegate tasks to specialist agents",
    parameters: Type.Object({
      agent_id: Type.String({ description: "ID of the target agent (e.g. researcher, coder, writer)" }),
      task: Type.String({ description: "Clear description of the task to delegate" }),
    }),
    async execute(
      _toolCallId: string,
      params: { agent_id: string; task: string },
      _signal?: AbortSignal,
      onUpdate?: (result: any) => void,
    ) {
      const agent = registry.getAgent(params.agent_id);
      if (!agent) {
        const available = registry
          .listAgents()
          .map((a) => a.id)
          .join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: `Agent "${params.agent_id}" not found. Available agents: ${available}`,
            },
          ],
          details: undefined,
        };
      }

      onUpdate?.({
        content: [{ type: "text" as const, text: `Delegating to ${params.agent_id}...` }],
        details: undefined,
      });

      try {
        const response = await registry.sendToAgent(params.agent_id, params.task);
        return {
          content: [
            {
              type: "text" as const,
              text: `Response from ${params.agent_id}:\n\n${response}`,
            },
          ],
          details: undefined,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text" as const, text: `Agent "${params.agent_id}" failed: ${msg}` },
          ],
          details: undefined,
        };
      }
    },
  };
}

export function createListAgentsTool(registry: AgentRegistry): any {
  return {
    name: "list_agents",
    label: "List Agents",
    description: "List all available specialist agents and their roles.",
    parameters: Type.Object({}),
    async execute() {
      const agents = registry.listAgents();
      const lines = agents.map((a) => `- **${a.id}**: ${a.config.name ?? a.id}`);
      return {
        content: [
          { type: "text" as const, text: `Available agents:\n${lines.join("\n")}` },
        ],
        details: undefined,
      };
    },
  };
}
