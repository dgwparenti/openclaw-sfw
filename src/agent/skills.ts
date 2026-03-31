import fs from "node:fs";
import path from "node:path";
import { loadSkillsFromDir, formatSkillsForPrompt, type Skill } from "@mariozechner/pi-coding-agent";

export { formatSkillsForPrompt };

export function loadSkillsFromPaths(paths: string[]): Skill[] {
  const allSkills: Skill[] = [];

  for (const dir of paths) {
    if (!fs.existsSync(dir)) continue;
    try {
      const result = loadSkillsFromDir({ dir, source: dir });
      allSkills.push(...result.skills);
    } catch {
      // Skip directories that fail to load
    }
  }

  return allSkills;
}

export function loadAllSkillsForAgent(
  sharedSkillsDir: string,
  agentDir: string,
  extraPaths: string[],
): Skill[] {
  const paths = [
    sharedSkillsDir,
    path.join(agentDir, "skills"),
    ...extraPaths,
  ];
  return loadSkillsFromPaths(paths);
}

export function ensureDefaultSkills(skillsDir: string): void {
  fs.mkdirSync(skillsDir, { recursive: true });

  const summarizeDir = path.join(skillsDir, "summarize");
  const summarizePath = path.join(summarizeDir, "SKILL.md");
  if (!fs.existsSync(summarizePath)) {
    fs.mkdirSync(summarizeDir, { recursive: true });
    fs.writeFileSync(
      summarizePath,
      `---
name: summarize
description: Summarize documents or text concisely
---

When asked to summarize, follow these steps:
1. Read the full content carefully
2. Identify the key points and main themes
3. Write a concise summary (aim for 20-30% of original length)
4. Include the most important facts, decisions, and action items
5. Use bullet points for clarity when appropriate
`,
    );
  }

  const codeReviewDir = path.join(skillsDir, "code-review");
  const codeReviewPath = path.join(codeReviewDir, "SKILL.md");
  if (!fs.existsSync(codeReviewPath)) {
    fs.mkdirSync(codeReviewDir, { recursive: true });
    fs.writeFileSync(
      codeReviewPath,
      `---
name: code-review
description: Review code for bugs, style, and security issues
---

When reviewing code:
1. Check for common bugs (null references, off-by-one errors, race conditions)
2. Look for security vulnerabilities (injection, XSS, hardcoded secrets)
3. Evaluate code style and consistency
4. Suggest improvements for readability and maintainability
5. Rate severity: critical, warning, suggestion
6. Provide a summary with overall assessment
`,
    );
  }
}
