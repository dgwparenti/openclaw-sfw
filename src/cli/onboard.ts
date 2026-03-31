import readline from "node:readline";
import { loadConfig, saveConfig } from "../config/loader.js";
import { ensureAllAgentWorkspaces } from "../agent/workspace.js";
import { ensureDefaultSkills } from "../agent/skills.js";
import { resolveHomePath } from "../config/loader.js";

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function runOnboard(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n  Welcome to OpenClaw\n");
  console.log("  This wizard sets up your multi-agent system.\n");

  const config = loadConfig();

  // Step 1: Pick provider (applies to all agents by default)
  console.log("  Step 1: Choose your default AI provider\n");
  console.log("    1) Anthropic (Claude API)");
  console.log("    2) Ollama (local models like QWEN, Llama)");
  console.log("    3) OpenAI-compatible endpoint\n");

  const providerChoice = await prompt(rl, "  Your choice [1/2/3]: ");
  let defaultProvider: "anthropic" | "openai" | "ollama" = "anthropic";
  let defaultModel = "claude-sonnet-4-20250514";

  if (providerChoice === "1" || providerChoice === "") {
    defaultProvider = "anthropic";
    const apiKey = await prompt(rl, "  Anthropic API key: ");
    if (apiKey.trim()) config.providers.anthropic = { apiKey: apiKey.trim() };
    defaultModel = "claude-sonnet-4-20250514";
  } else if (providerChoice === "2") {
    defaultProvider = "ollama";
    const baseURL = await prompt(rl, "  Ollama base URL [http://localhost:11434/v1]: ");
    config.providers.ollama = { baseURL: baseURL.trim() || "http://localhost:11434/v1" };
    const model = await prompt(rl, "  Model name [qwen2.5:72b]: ");
    defaultModel = model.trim() || "qwen2.5:72b";
  } else if (providerChoice === "3") {
    defaultProvider = "openai";
    const baseURL = await prompt(rl, "  API base URL: ");
    const apiKey = await prompt(rl, "  API key (optional): ");
    config.providers.openai = { baseURL: baseURL.trim() || undefined, apiKey: apiKey.trim() || undefined };
    const model = await prompt(rl, "  Model name: ");
    defaultModel = model.trim();
  }

  // Apply provider to all agents
  for (const agent of config.agents) {
    agent.provider = defaultProvider;
    agent.model = defaultModel;
  }

  // Step 2: Agents
  console.log("\n  Step 2: Agent configuration\n");
  console.log("  Default agents:");
  for (const a of config.agents) {
    const coord = a.isCoordinator ? " [coordinator]" : "";
    console.log(`    - ${a.id}: ${a.name ?? a.id}${coord}`);
  }
  console.log("");

  const addMore = await prompt(rl, "  Add a custom agent? (Enter to skip, or type agent ID): ");
  if (addMore.trim()) {
    const id = addMore.trim().toLowerCase().replace(/\s+/g, "-");
    const name = await prompt(rl, `  Display name for "${id}": `);
    config.agents.push({
      id,
      name: name.trim() || id,
      provider: defaultProvider,
      model: defaultModel,
      skills: [],
      isCoordinator: false,
    });
    console.log(`  Added agent: ${id}`);
  }

  // Step 3: Sandbox
  console.log("\n  Step 3: Approve filesystem directories\n");
  console.log("  Your agents can read/write files only in approved directories.\n");

  let addingDirs = true;
  while (addingDirs) {
    const dirPath = await prompt(rl, "  Directory to approve (or Enter to skip): ");
    if (!dirPath.trim()) { addingDirs = false; break; }
    const mode = await prompt(rl, "  Access mode [read/write] (default: read): ");
    const isWrite = mode.trim().toLowerCase() === "write";
    if (isWrite) {
      if (!config.sandbox.readWrite.includes(dirPath.trim())) config.sandbox.readWrite.push(dirPath.trim());
    } else {
      if (!config.sandbox.read.includes(dirPath.trim())) config.sandbox.read.push(dirPath.trim());
    }
    console.log(`  Added ${isWrite ? "read-write" : "read-only"}: ${dirPath.trim()}`);
  }

  // Save and create workspaces
  saveConfig(config);
  ensureAllAgentWorkspaces(config);
  ensureDefaultSkills(resolveHomePath(config.skillsDir));

  console.log("\n  Setup complete!\n");
  console.log("  Agent workspaces created at ~/.openclaw/agents/");
  console.log("  Shared skills at ~/.openclaw/skills/");
  console.log("");
  console.log("  Next steps:");
  console.log("    openclaw chat                         # Start chatting (coordinator)");
  console.log("    openclaw agents list                  # View agents");
  console.log("    openclaw sandbox add ~/Documents      # Approve more directories\n");

  rl.close();
}
