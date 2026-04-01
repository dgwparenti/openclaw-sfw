# OfficeClaw SFW - Multi-Agent Framework

A minimal, multi-agent AI framework with sandboxed filesystem access, persistent identity, memory, scheduled behaviors, and skills. A coordinator agent delegates tasks to specialist agents.

Forked from [OfficeClaw](https://github.com/officeclaw/officeclaw) and stripped down to essentials. Source: [dgwparenti/officeclaw-sfw](https://github.com/dgwparenti/officeclaw-sfw).

## What It Does

- **Multi-Agent System** -- coordinator + specialist agents (researcher, coder, writer), each with their own personality, memory, and session history
- **Agent Coordination** -- the coordinator breaks tasks into sub-tasks and delegates to the right specialist via a `delegate_to_agent` tool
- **Skills** -- markdown instruction files (shared or per-agent) that extend agent capabilities
- **Sandboxed Filesystem Access** -- agents can read/write files on your machine, but ONLY within directories you explicitly approve
- **Persistent Identity** -- each agent has its own SOUL.md, MEMORY.md, HEARTBEAT.md, and session history
- **Audit Logging** -- every file operation (allowed or denied) is logged
- **Multi-Provider Support** -- Anthropic Claude, OpenAI, Ollama (QWEN, Llama, etc.)
- **Write Confirmation Gate** -- optional prompt before file modifications outside the workspace
- **Heartbeat/Cron** -- scheduled tasks defined in HEARTBEAT.md, executed automatically
- **Professional/SFW Defaults** -- clean, work-appropriate default personalities

## How Coordination Works

```
User --> Coordinator Agent --> delegate_to_agent tool --> Specialist Agent
              |                                           (researcher, coder, writer)
              +-- synthesizes results into final answer <--+
```

1. You chat with the **coordinator** (the default agent)
2. The coordinator understands your request and breaks it into sub-tasks
3. It delegates each sub-task to the most appropriate **specialist** using `delegate_to_agent`
4. Specialists execute the task using their tools (read/write/edit/bash/etc.)
5. The coordinator synthesizes the results into a coherent response

You can also chat directly with any agent using `/switch <id>` in the chat REPL.

## Quick Start

```bash
# Clone
git clone git@github.com:dgwparenti/officeclaw-sfw.git
cd officeclaw-sfw
git checkout sfw-dev

# Install dependencies (pnpm or npm)
pnpm install   # or: npm install

# First-time setup (pick provider, configure agents, approve directories)
npx tsx src/cli/main.ts onboard

# Approve directories for agents to access
npx tsx src/cli/main.ts sandbox add ~/Documents
npx tsx src/cli/main.ts sandbox add ~/Desktop --write

# Start chatting (connects to coordinator by default)
npx tsx src/cli/main.ts chat

# Or build and run the compiled version
npm run build
node dist/cli/main.js chat
```

## Default Agents

| Agent | Role | Description |
|-------|------|-------------|
| **coordinator** | Orchestrator | Breaks tasks into sub-tasks, delegates to specialists, synthesizes results |
| **researcher** | Research & Analysis | Reads and analyzes documents, finds patterns, summarizes information |
| **coder** | Software Engineering | Reads, writes, and edits code, debugging, code review |
| **writer** | Technical Writing | Creates documentation, edits for clarity, structures information |

Each agent has its own workspace at `~/.officeclaw/agents/<id>/` with independent SOUL.md (personality), MEMORY.md, session history, and optional agent-specific skills.

## Commands

### CLI Commands

| Command | Description |
|---------|-------------|
| `officeclaw chat` | Start interactive chat (default: coordinator) |
| `officeclaw agents list` | List all configured agents |
| `officeclaw agents add <id> [--name <name>]` | Add a new specialist agent |
| `officeclaw agents remove <id>` | Remove an agent from config |
| `officeclaw sandbox list` | Show approved directories |
| `officeclaw sandbox add <path> [--write]` | Approve a directory |
| `officeclaw sandbox remove <path>` | Revoke access |
| `officeclaw sandbox test <path>` | Check if a path is accessible |
| `officeclaw sandbox log [--denied]` | View audit log |
| `officeclaw sandbox deny <glob>` | Add a deny pattern |
| `officeclaw sandbox reset` | Remove all approved directories |
| `officeclaw onboard` | First-time setup wizard |
| `officeclaw doctor` | Health check |

### Chat Commands (inside the REPL)

| Command | Description |
|---------|-------------|
| `/agents` | List all agents and which is active |
| `/switch <id>` | Switch to a different agent (e.g. `/switch coder`) |
| `/new` | Start a new session for the active agent |
| `/exit` | Quit |

## Skills

Skills are markdown instruction files that extend what agents can do. They are loaded into the agent's system prompt automatically.

### Shared Skills (available to all agents)

Located at `~/.officeclaw/skills/`. Default skills created on setup:

- `summarize/SKILL.md` -- Summarize documents or text concisely
- `code-review/SKILL.md` -- Review code for bugs, style, and security

### Per-Agent Skills

Located at `~/.officeclaw/agents/<id>/skills/`. Only available to that specific agent.

### Skill Format

```markdown
---
name: my-skill
description: What this skill does
---

Instructions for the agent when this skill is relevant...
```

## Configuration

Config lives at `~/.officeclaw/config.json`:

```jsonc
{
  "providers": {
    "anthropic": { "apiKey": "sk-..." },
    "ollama": { "baseURL": "http://localhost:11434/v1" }
  },
  "agents": [
    { "id": "coordinator", "name": "Coordinator", "provider": "anthropic", "model": "claude-sonnet-4-20250514", "isCoordinator": true },
    { "id": "researcher", "name": "Researcher", "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    { "id": "coder", "name": "Coder", "provider": "anthropic", "model": "claude-sonnet-4-20250514" },
    { "id": "writer", "name": "Writer", "provider": "anthropic", "model": "claude-sonnet-4-20250514" }
  ],
  "defaultAgent": "coordinator",
  "skillsDir": "~/.officeclaw/skills",
  "sandbox": {
    "read": ["~/Documents"],
    "readWrite": ["~/Desktop"],
    "deny": ["**/.env", "**/.git/**", "**/*.pem", "**/*.key"],
    "confirmWrites": true,
    "auditLog": true,
    "maxFileSizeMB": 10,
    "autoApprove": []
  }
}
```

Each agent can use a different provider and model. For example, you could run the coordinator on Claude Opus and specialists on a local QWEN model via Ollama.

## Security Model

**Default-deny, explicit-allow.** No directory is accessible until you add it. Agent workspaces are the only implicit exception.

- Path validation happens in code, before any disk I/O -- not via LLM instructions
- Symlink resolution prevents escape attacks
- Deny patterns block sensitive files (.env, .pem, .key, node_modules, .git)
- Write confirmation gate prompts before file modifications outside the workspace
- All operations are audit-logged to `~/.officeclaw/audit.jsonl`

## Workspace Files

Each agent has these files in its workspace (`~/.officeclaw/agents/<id>/`):

| File | Purpose |
|------|---------|
| `SOUL.md` | Personality, values, tone, role definition |
| `MEMORY.md` | Persistent memory across sessions |
| `HEARTBEAT.md` | Scheduled task definitions (cron) |
| `AGENTS.md` | Operational rules |
| `USER.md` | User context |
| `IDENTITY.md` | Agent identity/name |
| `TOOLS.md` | Tool usage conventions |
| `BOOTSTRAP.md` | First-run initialization |
| `sessions/` | Session history (JSONL, auto-persisted) |
| `skills/` | Agent-specific skills |

## Supported Providers

- **Anthropic** -- Claude models via API key
- **OpenAI** -- GPT models via API key
- **Ollama** -- Local models (QWEN, Llama, Mistral, etc.) via OpenAI-compatible API

## Directory Structure

```
~/.officeclaw/
  config.json              Global configuration
  audit.jsonl              Audit log of all file operations
  skills/                  Shared skills (available to all agents)
    summarize/SKILL.md
    code-review/SKILL.md
  agents/
    coordinator/           Coordinator agent workspace
      SOUL.md
      MEMORY.md
      sessions/
      skills/
    researcher/            Researcher agent workspace
      SOUL.md
      MEMORY.md
      sessions/
    coder/                 Coder agent workspace
    writer/                Writer agent workspace
```

## Architecture

```
src/
  agent/
    runner.ts          Multi-agent runner (creates registry, wires delegation)
    registry.ts        AgentRegistry -- manages N independent AgentSessions
    delegate-tool.ts   delegate_to_agent + list_agents tools for coordinator
    workspace.ts       Per-agent workspace creation, boot file loading, system prompt
    templates.ts       Default SOUL.md templates per role
    skills.ts          Skills loading from shared + per-agent directories
    heartbeat.ts       HEARTBEAT.md parser + scheduled task execution
  cli/
    main.ts            CLI entry point with command routing
    chat.ts            Interactive REPL with streaming, /agents, /switch
    onboard.ts         First-time setup wizard
    doctor.ts          Health checks
    sandbox-cmd.ts     Sandbox management commands
  config/
    schema.ts          Zod config schema (agents[], sandbox, providers)
    loader.ts          Config load/save, path resolution
  sandbox/
    path-validator.ts  Multi-root path validation with symlink protection
    audit-logger.ts    JSONL audit log
    tools.ts           Sandboxed tool wrappers with confirmation gate
    confirmation.ts    CLI write confirmation prompt
```

18 TypeScript files, ~2,000 lines of code.

## Credits

Forked from [OfficeClaw](https://github.com/officeclaw/officeclaw). Stripped from 8,700+ files to 18 files while preserving the core agent runtime concepts and adding multi-agent coordination.

## License

MIT
