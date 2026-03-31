import fs from "node:fs";
import path from "node:path";

export type HeartbeatTask = {
  name: string;
  schedule: string;
  description: string;
};

/**
 * Parse HEARTBEAT.md for task definitions.
 *
 * Expected format:
 * ```
 * ### Task Name
 * - Schedule: daily at 9:00 AM
 * - Task: Do something useful
 * ```
 */
export function parseHeartbeatMd(content: string): HeartbeatTask[] {
  const tasks: HeartbeatTask[] = [];
  const lines = content.split("\n");
  let currentName: string | undefined;
  let currentSchedule: string | undefined;
  let currentDescription: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    // H3 heading = task name
    const h3Match = trimmed.match(/^###\s+(.+)/);
    if (h3Match) {
      // Save previous task if complete
      if (currentName && currentSchedule && currentDescription) {
        tasks.push({ name: currentName, schedule: currentSchedule, description: currentDescription });
      }
      currentName = h3Match[1].trim();
      currentSchedule = undefined;
      currentDescription = undefined;
      continue;
    }

    if (!currentName) continue;

    // Schedule line
    const scheduleMatch = trimmed.match(/^-\s*Schedule:\s*(.+)/i);
    if (scheduleMatch) {
      currentSchedule = scheduleMatch[1].trim();
      continue;
    }

    // Task/description line
    const taskMatch = trimmed.match(/^-\s*Task:\s*(.+)/i);
    if (taskMatch) {
      currentDescription = taskMatch[1].trim();
      continue;
    }
  }

  // Don't forget the last task
  if (currentName && currentSchedule && currentDescription) {
    tasks.push({ name: currentName, schedule: currentSchedule, description: currentDescription });
  }

  return tasks;
}

type HeartbeatState = Record<string, string>; // taskName -> ISO timestamp of last run

function loadState(statePath: string): HeartbeatState {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf-8"));
  } catch {
    return {};
  }
}

function saveState(statePath: string, state: HeartbeatState): void {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
}

/**
 * Check if a task is due based on its schedule string.
 *
 * Supported schedules:
 * - "every N minutes" / "every N hours"
 * - "hourly"
 * - "daily" / "daily at HH:MM"
 */
export function isTaskDue(task: HeartbeatTask, lastRun: Date | null, now: Date): boolean {
  const schedule = task.schedule.toLowerCase();

  // "every N minutes"
  const minutesMatch = schedule.match(/every\s+(\d+)\s*min/);
  if (minutesMatch) {
    const intervalMs = parseInt(minutesMatch[1], 10) * 60 * 1000;
    if (!lastRun) return true;
    return now.getTime() - lastRun.getTime() >= intervalMs;
  }

  // "every N hours"
  const hoursMatch = schedule.match(/every\s+(\d+)\s*hour/);
  if (hoursMatch) {
    const intervalMs = parseInt(hoursMatch[1], 10) * 60 * 60 * 1000;
    if (!lastRun) return true;
    return now.getTime() - lastRun.getTime() >= intervalMs;
  }

  // "hourly"
  if (schedule === "hourly") {
    if (!lastRun) return true;
    return now.getTime() - lastRun.getTime() >= 60 * 60 * 1000;
  }

  // "daily" or "daily at HH:MM"
  if (schedule.startsWith("daily")) {
    if (!lastRun) return true;
    const lastDate = lastRun.toISOString().split("T")[0];
    const nowDate = now.toISOString().split("T")[0];
    if (lastDate === nowDate) return false; // Already ran today

    const timeMatch = schedule.match(/at\s+(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const targetHour = parseInt(timeMatch[1], 10);
      const targetMinute = parseInt(timeMatch[2], 10);
      return now.getHours() >= targetHour && now.getMinutes() >= targetMinute;
    }
    return true; // "daily" without time — run once per day
  }

  return false;
}

export function startHeartbeatLoop(params: {
  workspaceDir: string;
  intervalMs?: number;
  onTaskDue: (task: HeartbeatTask) => Promise<void>;
}): { stop: () => void } {
  const { workspaceDir, intervalMs = 60_000, onTaskDue } = params;
  const heartbeatPath = path.join(workspaceDir, "HEARTBEAT.md");
  const statePath = path.join(workspaceDir, "heartbeat-state.json");

  let running = true;

  const check = async () => {
    if (!running) return;
    if (!fs.existsSync(heartbeatPath)) return;

    const content = fs.readFileSync(heartbeatPath, "utf-8");
    const tasks = parseHeartbeatMd(content);
    if (tasks.length === 0) return;

    const state = loadState(statePath);
    const now = new Date();

    for (const task of tasks) {
      const lastRunStr = state[task.name];
      const lastRun = lastRunStr ? new Date(lastRunStr) : null;

      if (isTaskDue(task, lastRun, now)) {
        state[task.name] = now.toISOString();
        saveState(statePath, state);

        try {
          await onTaskDue(task);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Heartbeat] Error running "${task.name}": ${msg}`);
        }
      }
    }
  };

  const timer = setInterval(check, intervalMs);
  // Run an initial check after a short delay
  setTimeout(check, 5000);

  return {
    stop() {
      running = false;
      clearInterval(timer);
    },
  };
}
