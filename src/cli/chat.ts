import readline from "node:readline";
import { createAgentRunner } from "../agent/runner.js";
import { startHeartbeatLoop } from "../agent/heartbeat.js";
import { createCliConfirmationGate } from "../sandbox/confirmation.js";
import { resolveAgentDir } from "../config/loader.js";
import type { AppConfig } from "../config/schema.js";

export async function runChat(config: AppConfig): Promise<void> {
  console.log("Starting agents...\n");

  const runner = await createAgentRunner({
    config,
    confirmationGate: createCliConfirmationGate(),
  });

  const active = runner.activeAgent;
  console.log(`Active agent: ${active.config.name ?? active.id} (${active.id})`);
  console.log(`Model: ${active.config.model}`);
  console.log(`Agents: ${runner.registry.listAllAgents().map((a) => a.id).join(", ")}`);
  console.log(`\nCommands: /agents, /switch <id>, /new, /exit\n`);

  // Subscribe to events for streaming output
  let isStreaming = false;

  const setupSubscription = () => {
    runner.subscribe((event) => {
      switch (event.type) {
        case "message_update": {
          const ame = (event as any).assistantMessageEvent;
          if (ame?.type === "text_delta") {
            if (!isStreaming) isStreaming = true;
            process.stdout.write(ame.delta);
          }
          break;
        }
        case "tool_execution_start":
          process.stdout.write(`\n  [tool: ${event.toolName}] `);
          break;
        case "tool_execution_end":
          process.stdout.write(event.isError ? "(error)\n" : "(done)\n");
          break;
        case "agent_end":
          if (isStreaming) {
            process.stdout.write("\n");
            isStreaming = false;
          }
          break;
      }
    });
  };

  setupSubscription();

  // Start heartbeat for the active agent
  const agentDir = resolveAgentDir(runner.activeAgentId);
  const heartbeat = startHeartbeatLoop({
    workspaceDir: agentDir,
    intervalMs: 60_000,
    onTaskDue: async (task) => {
      console.log(`\n  [heartbeat] Running: ${task.name}`);
      try {
        await runner.sendMessage(`[Heartbeat Task] ${task.description}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  [heartbeat] Error: ${msg}`);
      }
      rl.prompt();
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `\n[${runner.activeAgentId}] > `,
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === "/exit" || input === "/quit") {
      console.log("Goodbye.");
      heartbeat.stop();
      runner.dispose();
      rl.close();
      process.exit(0);
    }

    if (input === "/agents") {
      const agents = runner.registry.listAllAgents();
      console.log("\nAgents:");
      for (const a of agents) {
        const marker = a.id === runner.activeAgentId ? " (active)" : "";
        const coord = a.config.isCoordinator ? " [coordinator]" : "";
        console.log(`  ${a.id}: ${a.config.name ?? a.id}${coord}${marker}`);
      }
      rl.prompt();
      return;
    }

    if (input.startsWith("/switch ")) {
      const targetId = input.slice(8).trim();
      if (runner.switchAgent(targetId)) {
        setupSubscription();
        rl.setPrompt(`\n[${runner.activeAgentId}] > `);
        console.log(`Switched to ${runner.activeAgent.config.name ?? targetId}`);
      } else {
        console.log(`Agent "${targetId}" not found. Use /agents to see available agents.`);
      }
      rl.prompt();
      return;
    }

    if (input === "/new") {
      await runner.newSession();
      console.log("New session started.");
      rl.prompt();
      return;
    }

    try {
      await runner.sendMessage(input);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\nError: ${msg}`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    heartbeat.stop();
    runner.dispose();
    process.exit(0);
  });
}
