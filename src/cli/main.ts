#!/usr/bin/env node
import { loadConfig, saveConfig, resolveAgentDir } from "../config/loader.js";
import { runChat } from "./chat.js";
import { runSandboxCommand } from "./sandbox-cmd.js";
import { runOnboard } from "./onboard.js";
import { runDoctor } from "./doctor.js";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "chat":
      await runChat(loadConfig());
      break;

    case "sandbox":
      runSandboxCommand(args.slice(1));
      break;

    case "agents":
      runAgentsCommand(args.slice(1));
      break;

    case "onboard":
      await runOnboard();
      break;

    case "doctor":
      runDoctor();
      break;

    case "--version":
    case "-v":
      console.log("openclaw 0.2.0");
      break;

    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
openclaw - Multi-Agent SFW Framework

Usage: openclaw <command> [options]

Commands:
  chat              Start an interactive chat session (default: coordinator)
  agents            Manage agents (list, add, remove)
  sandbox           Manage filesystem access (list, add, remove, test, log)
  onboard           First-time setup wizard
  doctor            Run health checks

Chat commands (inside chat):
  /agents           List all agents
  /switch <id>      Switch active agent
  /new              Start new session
  /exit             Quit

Options:
  --version         Show version
  --help            Show this help
`);
}

function runAgentsCommand(subArgs: string[]) {
  const sub = subArgs[0];
  const config = loadConfig();

  switch (sub) {
    case "list":
    case undefined: {
      console.log("\nConfigured agents:\n");
      for (const a of config.agents) {
        const coord = a.isCoordinator ? " [coordinator]" : "";
        const isDefault = a.id === config.defaultAgent ? " (default)" : "";
        const dir = resolveAgentDir(a.id);
        console.log(`  ${a.id}: ${a.name ?? a.id}${coord}${isDefault}`);
        console.log(`    Provider: ${a.provider} / ${a.model}`);
        console.log(`    Dir: ${dir}`);
      }
      console.log("");
      break;
    }

    case "add": {
      const id = subArgs[1];
      if (!id) {
        console.error("Usage: openclaw agents add <id> [--name <name>]");
        return;
      }
      if (config.agents.some((a) => a.id === id)) {
        console.error(`Agent "${id}" already exists.`);
        return;
      }
      const nameIdx = subArgs.indexOf("--name");
      const name = nameIdx >= 0 ? subArgs[nameIdx + 1] : id;
      const defaultAgent = config.agents[0];
      config.agents.push({
        id,
        name,
        provider: defaultAgent?.provider ?? "anthropic",
        model: defaultAgent?.model ?? "claude-sonnet-4-20250514",
        skills: [],
        isCoordinator: false,
      });
      saveConfig(config);
      console.log(`Added agent: ${id} (${name})`);
      console.log(`Edit its personality: ~/.openclaw/agents/${id}/SOUL.md`);
      break;
    }

    case "remove": {
      const id = subArgs[1];
      if (!id) {
        console.error("Usage: openclaw agents remove <id>");
        return;
      }
      const idx = config.agents.findIndex((a) => a.id === id);
      if (idx < 0) {
        console.error(`Agent "${id}" not found.`);
        return;
      }
      config.agents.splice(idx, 1);
      saveConfig(config);
      console.log(`Removed agent "${id}" from config. Directory preserved at ~/.openclaw/agents/${id}/`);
      break;
    }

    default:
      console.log("Usage: openclaw agents <list|add|remove>");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message || err);
  process.exit(1);
});
