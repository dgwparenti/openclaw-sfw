# OfficeClaw SFW Tutorial

A hands-on walkthrough that exercises every agent and feature. Work through each section in order.

**Prerequisites:** Node.js 22+, an Anthropic API key (or Ollama running locally).

---

## 1. Initial Setup

### 1.1 Install and onboard

```bash
cd officeclaw-sfw
pnpm install          # or: npm install
npx tsx src/cli/main.ts onboard
```

The wizard will ask you to:
1. Pick a provider (Anthropic, Ollama, or OpenAI-compatible)
2. Enter your API key or endpoint
3. Review the default agents (coordinator, researcher, coder, writer)
4. Approve filesystem directories

### 1.2 Verify setup

```bash
npx tsx src/cli/main.ts doctor
```

Expected output:
```
  [1/5] Configuration
    OK: Config at ~/.officeclaw/config.json

  [2/5] Agents
    OK: coordinator [coordinator]
    OK: researcher
    OK: coder
    OK: writer

  [3/5] Provider
    OK: API key configured

  [4/5] Skills
    Skills dir: ~/.officeclaw/skills (2 skills)
      - code-review
      - summarize

  [5/5] Runtime
    Node: v22.x.x

  All checks passed.
```

### 1.3 List agents

```bash
npx tsx src/cli/main.ts agents list
```

You should see 4 agents: coordinator (default), researcher, coder, writer.

---

## 2. Sandbox Security

The sandbox controls which directories agents can access. By default, only agent workspaces are accessible.

### 2.1 Create a test directory

```bash
mkdir -p ~/officeclaw-tutorial/projects
echo "Hello from the tutorial" > ~/officeclaw-tutorial/projects/hello.txt
echo "SECRET=do-not-read" > ~/officeclaw-tutorial/projects/.env
```

### 2.2 Test access before approval

```bash
npx tsx src/cli/main.ts sandbox test ~/officeclaw-tutorial/projects/hello.txt
```

Expected: both Read and Write show **DENIED**.

### 2.3 Approve the directory

```bash
npx tsx src/cli/main.ts sandbox add ~/officeclaw-tutorial/projects --write
```

### 2.4 Test access after approval

```bash
npx tsx src/cli/main.ts sandbox test ~/officeclaw-tutorial/projects/hello.txt
```

Expected: Read **ALLOWED**, Write **ALLOWED**.

### 2.5 Test deny patterns

```bash
npx tsx src/cli/main.ts sandbox test ~/officeclaw-tutorial/projects/.env
```

Expected: **DENIED** -- the `.env` deny pattern blocks it even though the directory is approved.

### 2.6 View sandbox config

```bash
npx tsx src/cli/main.ts sandbox list
```

### 2.7 View audit log

```bash
npx tsx src/cli/main.ts sandbox log
npx tsx src/cli/main.ts sandbox log --denied
```

---

## 3. Chatting with the Coordinator

The coordinator is the default agent. It delegates tasks to specialists.

### 3.1 Start a chat session

```bash
npx tsx src/cli/main.ts chat
```

You should see:
```
Active agent: Coordinator (coordinator)
Model: claude-sonnet-4-20250514
Agents: coordinator, researcher, coder, writer

Commands: /agents, /switch <id>, /new, /exit
```

### 3.2 List agents in chat

```
[coordinator] > /agents
```

### 3.3 Ask the coordinator to delegate

Try these prompts to see the coordinator use `delegate_to_agent`:

```
[coordinator] > Read the file ~/officeclaw-tutorial/projects/hello.txt and summarize what you find
```

The coordinator should delegate to the researcher. You will see tool calls like:
```
  [tool: delegate_to_agent] (done)
```

### 3.4 Multi-agent delegation

```
[coordinator] > Read ~/officeclaw-tutorial/projects/hello.txt, then write a more detailed version of it at ~/officeclaw-tutorial/projects/hello-v2.txt
```

The coordinator may delegate reading to the researcher and writing to the writer (or coder). Watch the tool calls to see which agents are invoked.

### 3.5 Exit chat

```
[coordinator] > /exit
```

---

## 4. Testing the Researcher Agent

### 4.1 Switch to the researcher

Start chat and switch:

```bash
npx tsx src/cli/main.ts chat
```

```
[coordinator] > /switch researcher
```

The prompt changes to `[researcher] >`.

### 4.2 Ask the researcher to analyze files

```
[researcher] > List all files in ~/officeclaw-tutorial/projects/ and describe what you find
```

The researcher should use the `ls` and `read` tools directly (no delegation -- it is a specialist).

### 4.3 Ask for a summary

```
[researcher] > Read ~/officeclaw-tutorial/projects/hello.txt and give me a detailed analysis of its contents
```

### 4.4 Test denied access

```
[researcher] > Read the file /etc/hosts
```

The sandbox should deny this. The agent should report the denial.

---

## 5. Testing the Coder Agent

### 5.1 Switch to the coder

```
[researcher] > /switch coder
```

### 5.2 Ask the coder to create a file

```
[coder] > Create a Python script at ~/officeclaw-tutorial/projects/fibonacci.py that prints the first 20 Fibonacci numbers
```

If `confirmWrites` is enabled (the default), you will be prompted:
```
  Agent wants to write: ~/officeclaw-tutorial/projects/fibonacci.py
  Preview: ...
  [A]pprove / [D]eny:
```

Type `A` to approve.

### 5.3 Ask the coder to review code

```
[coder] > Read ~/officeclaw-tutorial/projects/fibonacci.py and review it for any issues
```

### 5.4 Ask the coder to edit code

```
[coder] > Add error handling to fibonacci.py for negative input values
```

Approve the edit when prompted.

### 5.5 Verify the file was created

```bash
cat ~/officeclaw-tutorial/projects/fibonacci.py
```

---

## 6. Testing the Writer Agent

### 6.1 Switch to the writer

```
[coder] > /switch writer
```

### 6.2 Ask the writer to create documentation

```
[writer] > Read ~/officeclaw-tutorial/projects/fibonacci.py and create a README.md for it at ~/officeclaw-tutorial/projects/README.md
```

Approve the write when prompted.

### 6.3 Ask the writer to edit for tone

```
[writer] > Rewrite the README.md to be more beginner-friendly with step-by-step instructions
```

### 6.4 Verify

```bash
cat ~/officeclaw-tutorial/projects/README.md
```

---

## 7. Adding a Custom Agent

### 7.1 Add a new agent via CLI

```
[writer] > /exit
```

```bash
npx tsx src/cli/main.ts agents add analyst --name "Data Analyst"
```

### 7.2 Customize its personality

Edit the SOUL.md:

```bash
cat > ~/.officeclaw/agents/analyst/SOUL.md << 'EOF'
# Data Analyst Agent

You are a data analyst. You excel at:
- Analyzing CSV, JSON, and structured data files
- Calculating statistics and identifying trends
- Creating data summaries with key metrics
- Suggesting visualizations for data

Always present findings with specific numbers and percentages.
Keep all interactions professional and safe for work.
EOF
```

### 7.3 Verify it appears in the list

```bash
npx tsx src/cli/main.ts agents list
```

You should see 5 agents now, including the new `analyst`.

### 7.4 Chat with the custom agent

```bash
npx tsx src/cli/main.ts chat
```

```
[coordinator] > /switch analyst
[analyst] > What kind of analysis can you help me with?
```

### 7.5 Clean up (optional)

```bash
npx tsx src/cli/main.ts agents remove analyst
```

---

## 8. The Config Agent

By default, agents cannot modify the OfficeClaw config or other agents' files — those paths are outside the sandbox. In this section you will create a dedicated **config agent** that has write access to the `~/.officeclaw/` directory, making it the single point of control for changing personas, models, and system settings.

> **Important:** Changes to `config.json` or SOUL.md files only take effect after restarting the chat.

### 8.1 Create the config agent

```bash
npx tsx src/cli/main.ts agents add config --name "Config Manager"
```

### 8.2 Grant it access to the OfficeClaw directory

The config agent needs read-write access to the entire `~/.officeclaw/` tree (config files, agent workspaces, skills):

```bash
npx tsx src/cli/main.ts sandbox add ~/.officeclaw --write
```

### 8.3 Give it a specialized SOUL.md

```bash
cat > ~/.officeclaw/agents/config/SOUL.md << 'EOF'
# Config Manager Agent

You are the OfficeClaw configuration manager. You are the ONLY agent with write access to the system config and other agents' workspace files.

## Your Responsibilities

1. **Edit agent personas** — modify any agent's `~/.officeclaw/agents/<id>/SOUL.md`
2. **Change models** — update `"provider"` and `"model"` fields in `~/.officeclaw/config.json`
3. **Manage agent settings** — add/remove agents in `config.json`, update skills directories
4. **Verify changes** — after any edit, read the file back and confirm it is valid JSON (for config.json) or valid Markdown (for SOUL.md)

## Config File Structure

The main config lives at `~/.officeclaw/config.json`:

```json
{
  "providers": {
    "anthropic": { "apiKey": "sk-..." },
    "ollama": { "baseURL": "http://localhost:11434/v1" }
  },
  "agents": [
    {
      "id": "coordinator",
      "name": "Coordinator",
      "provider": "ollama",
      "model": "llama3.1:8b-instruct-q8_0",
      "skills": [],
      "isCoordinator": true
    }
  ],
  "defaultAgent": "coordinator",
  "skillsDir": "~/.officeclaw/skills",
  "sandbox": { ... }
}
```

Key rules:
- Each agent has `"id"`, `"name"`, `"provider"`, `"model"`, `"skills"`, `"isCoordinator"`
- Valid providers: `"anthropic"`, `"openai"`, `"ollama"`
- For Ollama, the model ID must match exactly what `ollama list` shows (e.g. `"llama3.1:8b-instruct-q8_0"`)
- Exactly one agent should have `"isCoordinator": true`
- The `"defaultAgent"` must match an existing agent ID

## Agent Workspace Files

Each agent has a workspace at `~/.officeclaw/agents/<id>/`:
- `SOUL.md` — personality, role, guidelines (loaded into the system prompt)
- `MEMORY.md` — persistent memory across sessions
- `IDENTITY.md` — agent identity
- `HEARTBEAT.md` — scheduled tasks

## Workflow

When asked to make a change:
1. Read the current file first
2. Make the requested edit
3. Read it back to verify correctness
4. Tell the user to restart the chat for changes to take effect

Keep all interactions professional and safe for work.
EOF
```

### 8.4 Test: change an agent's persona

Start the chat and switch to the config agent:

```bash
npx tsx src/cli/main.ts chat
```

```
[coordinator] > /switch config
[config] > Make the researcher more focused on data science. Update its SOUL.md to emphasize statistical analysis, data visualization, and Python/pandas expertise.
```

The config agent should:
1. Read `~/.officeclaw/agents/researcher/SOUL.md`
2. Write an updated version
3. Read it back to confirm

After it finishes, exit and restart the chat, then verify:

```
[coordinator] > /switch researcher
[researcher] > What are your core skills?
```

The researcher should now reflect the updated persona.

### 8.5 Test: change an agent's model

```bash
npx tsx src/cli/main.ts chat
```

```
[coordinator] > /switch config
[config] > Change the coder agent to use the model "codellama:13b" on ollama. Read the config, make the change, and verify it.
```

The config agent should:
1. Read `~/.officeclaw/config.json`
2. Update the coder's `"model"` field
3. Read it back and confirm valid JSON

> **Note:** The new model must already be pulled in Ollama (`ollama pull codellama:13b`). The config agent changes the config but cannot pull models.

### 8.6 Test: mix providers across agents

Ask the config agent to set different providers for different agents:

```
[config] > Set the coordinator to use anthropic with model claude-sonnet-4-20250514, and keep all other agents on ollama with llama3.1:8b-instruct-q8_0. Make sure the anthropic provider section has a placeholder API key.
```

This demonstrates that each agent can run on a completely different backend.

### 8.7 Verify with doctor

After any config change, restart and run a health check:

```bash
npx tsx src/cli/main.ts doctor
```

Check that:
- All agents show the correct provider/model
- No warnings about missing workspaces
- The config agent appears in the agent list

### 8.8 Why a dedicated config agent?

- **Least privilege** — only the config agent has write access to `~/.officeclaw/`. Other agents cannot accidentally break the config or modify each other's personas.
- **Audit trail** — all config changes go through the sandbox audit log.
- **Validation** — the config agent's SOUL.md instructs it to verify changes, catching invalid JSON before it causes startup errors.
- **Delegation** — the coordinator can delegate config tasks to the config agent via `delegate_to_agent`, keeping the workflow natural.

---

## 9. Skills

Skills are markdown instruction files that extend agent capabilities.

### 9.1 View default skills

```bash
ls ~/.officeclaw/skills/
```

You should see `summarize/` and `code-review/`.

### 9.2 Read a default skill

```bash
cat ~/.officeclaw/skills/summarize/SKILL.md
```

### 9.3 Create a custom shared skill

```bash
mkdir -p ~/.officeclaw/skills/explain-like-im-five
cat > ~/.officeclaw/skills/explain-like-im-five/SKILL.md << 'EOF'
---
name: explain-like-im-five
description: Explain complex topics in simple terms a 5-year-old would understand
---

When asked to explain something simply:
1. Avoid all jargon and technical terms
2. Use everyday analogies (toys, food, animals, playground)
3. Keep sentences short (under 10 words when possible)
4. Use "imagine..." to set up analogies
5. Maximum 3 paragraphs
EOF
```

### 9.4 Create a per-agent skill

This skill will only be available to the coder agent:

```bash
mkdir -p ~/.officeclaw/agents/coder/skills/security-check
cat > ~/.officeclaw/agents/coder/skills/security-check/SKILL.md << 'EOF'
---
name: security-check
description: Check code for common security vulnerabilities
---

When reviewing code for security:
1. Check for SQL injection (string concatenation in queries)
2. Check for XSS (unescaped user input in HTML)
3. Check for hardcoded secrets (API keys, passwords in source)
4. Check for path traversal (user input in file paths)
5. Check for command injection (user input in shell commands)
6. Rate each finding: Critical, High, Medium, Low
7. Provide a fix for each issue found
EOF
```

### 9.5 Verify skills load

Run doctor to confirm the shared skill count increased:

```bash
npx tsx src/cli/main.ts doctor
```

The skills section should now show 3 skills (summarize, code-review, explain-like-im-five).

### 9.6 Test the skill in chat

```bash
npx tsx src/cli/main.ts chat
```

```
[coordinator] > /switch researcher
[researcher] > Explain how the internet works (use the explain-like-im-five approach)
```

---

## 10. Heartbeat (Scheduled Tasks)

The heartbeat system runs tasks on a schedule defined in each agent's HEARTBEAT.md.

### 10.1 Define a quick test task

Edit the coordinator's heartbeat:

```bash
cat > ~/.officeclaw/agents/coordinator/HEARTBEAT.md << 'EOF'
# Heartbeat

## Tasks

### Quick Check
- Schedule: every 1 minutes
- Task: Check if there are any new files in ~/officeclaw-tutorial/projects/ and briefly report what you see
EOF
```

### 10.2 Start chat and wait

```bash
npx tsx src/cli/main.ts chat
```

Within ~1 minute, you should see:
```
  [heartbeat] Running: Quick Check
```

The coordinator will execute the task and report results.

### 10.3 Disable the heartbeat

To stop the recurring task, remove it:

```bash
cat > ~/.officeclaw/agents/coordinator/HEARTBEAT.md << 'EOF'
# Heartbeat

## Tasks

(No tasks defined)
EOF
```

---

## 11. Session Management

Sessions persist across chat restarts. Each agent has independent sessions.

### 11.1 Start a conversation

```bash
npx tsx src/cli/main.ts chat
```

```
[coordinator] > Remember that my favorite programming language is Python
[coordinator] > /exit
```

### 11.2 Resume the session

```bash
npx tsx src/cli/main.ts chat
```

```
[coordinator] > What is my favorite programming language?
```

The agent should remember "Python" from the previous session (context is restored from the JSONL session file).

### 11.3 Start a fresh session

```
[coordinator] > /new
```

```
[coordinator] > What is my favorite programming language?
```

In the new session, the agent will not have the previous context (unless it was saved to MEMORY.md).

### 11.4 Check session files

```bash
ls ~/.officeclaw/agents/coordinator/sessions/
```

You should see `.jsonl` files for each session.

---

## 12. Audit Log

Every file operation (allowed or denied) is logged.

### 12.1 View all audit entries

```bash
npx tsx src/cli/main.ts sandbox log
```

### 12.2 View only denied operations

```bash
npx tsx src/cli/main.ts sandbox log --denied
```

### 12.3 Check the raw log

```bash
tail -5 ~/.officeclaw/audit.jsonl
```

Each line is a JSON object with: timestamp, operation, targetPath, resolvedPath, allowed, reason.

---

## 13. Doctor Health Check

### 13.1 Run a full health check

```bash
npx tsx src/cli/main.ts doctor
```

This checks:
1. Config file exists and is valid
2. All agent workspaces exist with SOUL.md
3. Provider API key is configured
4. Skills directory exists with skills
5. Node.js version and sandbox config

---

## 14. Cleanup

Remove the tutorial test files:

```bash
rm -rf ~/officeclaw-tutorial
npx tsx src/cli/main.ts sandbox remove ~/officeclaw-tutorial/projects
```

---

## Summary of Features Tested

| Feature | Section | What was tested |
|---------|---------|-----------------|
| Onboarding | 1 | Provider setup, agent creation, workspace initialization |
| Doctor | 1, 13 | Health check across all subsystems |
| Sandbox security | 2 | Approve/deny directories, deny patterns (.env), audit log |
| Coordinator delegation | 3 | delegate_to_agent tool, multi-agent task flow |
| Researcher agent | 4 | File analysis, summarization, denied access handling |
| Coder agent | 5 | Code creation, editing, write confirmation gate |
| Writer agent | 6 | Documentation creation, tone editing |
| Custom agents | 7 | agents add, SOUL.md customization, agents remove |
| Config agent | 8 | Dedicated agent for managing config, personas, models, verification |
| Shared skills | 9 | Default skills, custom shared skill creation |
| Per-agent skills | 9 | Coder-specific security-check skill |
| Heartbeat/cron | 10 | Scheduled task definition, automatic execution |
| Session persistence | 11 | Cross-restart memory, /new for fresh sessions |
| Audit logging | 12 | View all ops, filter denied, raw JSONL |
| Write confirmation | 5 | Approve/Deny prompt before file writes |
| Agent switching | 4-6 | /switch between agents in chat |
| Multi-provider | 1, 8 | Anthropic, Ollama, OpenAI-compatible setup, per-agent model config |
