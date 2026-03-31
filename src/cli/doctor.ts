import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, resolveAgentDir, resolveSkillsDir } from "../config/loader.js";

export function runDoctor(): void {
  console.log("\n  OpenClaw Doctor\n");

  const config = loadConfig();
  let issues = 0;

  // Check config
  console.log("  [1/5] Configuration");
  const configPath = path.join(os.homedir(), ".openclaw", "config.json");
  if (fs.existsSync(configPath)) {
    console.log(`    OK: Config at ${configPath}`);
  } else {
    console.log(`    WARN: No config. Run 'openclaw onboard'.`);
    issues++;
  }

  // Check agents
  console.log("\n  [2/5] Agents");
  for (const agentDef of config.agents) {
    const agentDir = resolveAgentDir(agentDef.id);
    const exists = fs.existsSync(agentDir);
    const hasSoul = exists && fs.existsSync(path.join(agentDir, "SOUL.md"));
    const marker = agentDef.isCoordinator ? " [coordinator]" : "";
    if (exists && hasSoul) {
      console.log(`    OK: ${agentDef.id}${marker} — ${agentDir}`);
    } else {
      console.log(`    WARN: ${agentDef.id}${marker} — workspace missing. Run 'openclaw onboard'.`);
      issues++;
    }
  }

  // Check provider
  console.log("\n  [3/5] Provider");
  const defaultAgent = config.agents.find((a) => a.id === config.defaultAgent) ?? config.agents[0];
  if (defaultAgent) {
    console.log(`    Default: ${defaultAgent.id} (${defaultAgent.provider}/${defaultAgent.model})`);
    if (defaultAgent.provider === "anthropic") {
      const key = config.providers.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY;
      console.log(key ? `    OK: API key configured` : `    WARN: No Anthropic API key`);
      if (!key) issues++;
    }
  }

  // Check skills
  console.log("\n  [4/5] Skills");
  const skillsDir = resolveSkillsDir(config);
  if (fs.existsSync(skillsDir)) {
    const skillDirs = fs.readdirSync(skillsDir).filter((f) =>
      fs.existsSync(path.join(skillsDir, f, "SKILL.md")),
    );
    console.log(`    Skills dir: ${skillsDir} (${skillDirs.length} skills)`);
    for (const s of skillDirs) console.log(`      - ${s}`);
  } else {
    console.log(`    Skills dir not found. Run 'openclaw onboard' to create defaults.`);
  }

  // Check sandbox + runtime
  console.log("\n  [5/5] Runtime");
  console.log(`    Node: ${process.version}`);
  console.log(`    Sandbox read dirs: ${config.sandbox.read.length}`);
  console.log(`    Sandbox write dirs: ${config.sandbox.readWrite.length}`);

  console.log("");
  if (issues === 0) {
    console.log("  All checks passed.\n");
  } else {
    console.log(`  ${issues} issue(s) found.\n`);
  }
}
