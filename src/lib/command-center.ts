import type {
  CommandTask,
  PreparationStatus,
  TaskStatus,
} from "@/types/command-center";

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  planned: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["waiting", "on_hold", "completed", "cancelled"],
  waiting: ["in_progress", "on_hold", "cancelled"],
  on_hold: ["planned", "in_progress", "cancelled"],
  completed: ["in_progress"],
  cancelled: ["planned"],
};

export function todayInTimeZone(now = new Date(), timeZone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function normalizeInboxText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

export function buildInboxDedupeKey(value: string) {
  const normalized = normalizeInboxText(value);
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus) {
  return from === to || TASK_TRANSITIONS[from].includes(to);
}

export function getPreparationStatus(
  tasks: CommandTask[],
  today = todayInTimeZone()
): PreparationStatus {
  const required = tasks.filter((item) => item.is_required && item.status !== "cancelled");
  if (required.length === 0) return "needs_information";

  const active = required.filter((item) => item.status !== "completed");
  if (active.length === 0) return "ready";

  if (
    active.some(
      (item) =>
        Boolean(item.blocked_reason) ||
        item.status === "on_hold" ||
        Boolean(item.due_date && item.due_date < today)
    )
  ) {
    return "action_required";
  }

  if (active.some((item) => !item.next_action || (!item.due_date && !item.scheduled_date))) {
    return "needs_information";
  }

  return "in_progress";
}

function operationalRank(task: CommandTask, today: string) {
  if (
    task.is_required &&
    task.status !== "completed" &&
    task.status !== "cancelled" &&
    task.due_date &&
    task.due_date < today
  ) return 0;
  if (task.due_date === today || task.status === "waiting") return 1;
  if (task.is_required && task.due_date) return 2;
  if (task.today_focus_order !== null) return 3;
  return 4;
}

export function sortOperationalTasks(tasks: CommandTask[], today = todayInTimeZone()) {
  return [...tasks].sort((left, right) => {
    const rankDiff = operationalRank(left, today) - operationalRank(right, today);
    if (rankDiff !== 0) return rankDiff;
    if (left.today_focus_order !== null || right.today_focus_order !== null) {
      return (left.today_focus_order ?? 99) - (right.today_focus_order ?? 99);
    }
    if (left.due_date || right.due_date) {
      return (left.due_date ?? "9999-12-31").localeCompare(right.due_date ?? "9999-12-31");
    }
    if (left.priority !== right.priority) return left.priority - right.priority;
    return left.created_at.localeCompare(right.created_at);
  });
}

export function getWeekStart(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - ((day + 6) % 7));
  return value.toISOString().slice(0, 10);
}

export function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
