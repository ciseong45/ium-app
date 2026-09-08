export type MinistryArea =
  | "worship_word"
  | "formation_leadership"
  | "newcomer_care"
  | "community_events"
  | "admin_finance"
  | "media_tech";

export type MinistryKind = "recurring" | "course" | "project";
export type MinistryStatus = "planned" | "active" | "paused" | "completed" | "cancelled";
export type OccurrenceStatus = "tentative" | "confirmed" | "cancelled";
export type TaskStatus = "planned" | "in_progress" | "waiting" | "on_hold" | "completed" | "cancelled";
export type DecisionStatus = "open" | "decided" | "cancelled";
export type ResourceVersionStatus = "draft" | "confirmed" | "superseded";
export type InboxStatus = "unprocessed" | "processed" | "duplicate" | "archived";
export type PreparationStatus = "ready" | "in_progress" | "action_required" | "needs_information";

export type CommandSeason = {
  id: string;
  owner_id: string;
  name: string;
  start_date: string;
  end_date: string;
  goal: string | null;
  retrospective: string | null;
  is_active: boolean;
  source_key: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommandMinistry = {
  id: string;
  owner_id: string;
  season_id: string | null;
  title: string;
  area: MinistryArea;
  kind: MinistryKind;
  status: MinistryStatus;
  purpose: string | null;
  start_date: string | null;
  end_date: string | null;
  current_blocker: string | null;
  source_url: string | null;
  last_reviewed_at: string | null;
  source_key: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommandOccurrence = {
  id: string;
  owner_id: string;
  ministry_id: string;
  title: string;
  status: OccurrenceStatus;
  starts_at: string | null;
  ends_at: string | null;
  date_only: string | null;
  timezone: string;
  location: string | null;
  sequence_label: string | null;
  source_key: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommandTask = {
  id: string;
  owner_id: string;
  title: string;
  area: MinistryArea;
  status: TaskStatus;
  next_action: string | null;
  completion_criteria: string | null;
  due_date: string | null;
  scheduled_date: string | null;
  priority: number;
  is_required: boolean;
  due_date_is_manual: boolean;
  blocked_reason: string | null;
  ministry_id: string | null;
  occurrence_id: string | null;
  source_inbox_id: string | null;
  today_focus_order: number | null;
  completion_evidence: string | null;
  started_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommandFollowup = {
  id: string;
  owner_id: string;
  task_id: string;
  request_text: string;
  person_label: string;
  requested_at: string;
  next_check_date: string;
  response_text: string | null;
  responded_at: string | null;
  status: "waiting" | "received" | "closed";
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommandDecision = {
  id: string;
  owner_id: string;
  ministry_id: string | null;
  question: string;
  status: DecisionStatus;
  options: string[];
  required_information: string | null;
  confirmed_choice: string | null;
  basis: string | null;
  due_date: string | null;
  decided_at: string | null;
  source_key: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommandResource = {
  id: string;
  owner_id: string;
  ministry_id: string | null;
  title: string;
  source_url: string;
  resource_type: string;
  version_status: ResourceVersionStatus;
  reference_date: string | null;
  verified_at: string | null;
  access_scope: string | null;
  source_key: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommandInboxItem = {
  id: string;
  owner_id: string;
  original_text: string;
  received_at: string;
  source: string | null;
  attachment_url: string | null;
  status: InboxStatus;
  produced_records: Array<{ type: string; id: string }>;
  dedupe_key: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommandWeeklyReview = {
  id: string;
  owner_id: string;
  week_start: string;
  reviewed_at: string | null;
  focus_task_ids: string[];
  incomplete_judgment: string | null;
  focus_blocks: Array<{ date: string; label: string }>;
  created_at: string;
  updated_at: string;
};

export type CommandCenterData = {
  ready: boolean;
  error?: string;
  seasons: CommandSeason[];
  ministries: CommandMinistry[];
  occurrences: CommandOccurrence[];
  tasks: CommandTask[];
  followups: CommandFollowup[];
  decisions: CommandDecision[];
  resources: CommandResource[];
  inbox: CommandInboxItem[];
  weeklyReviews: CommandWeeklyReview[];
};

export const AREA_LABELS: Record<MinistryArea, string> = {
  worship_word: "말씀·예배",
  formation_leadership: "양육·리더 육성",
  newcomer_care: "새가족·목양·순",
  community_events: "공동체·행사",
  admin_finance: "행정·재정",
  media_tech: "미디어·기술",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  planned: "예정",
  in_progress: "진행",
  waiting: "응답 대기",
  on_hold: "보류",
  completed: "완료",
  cancelled: "취소",
};

export const PREPARATION_STATUS_LABELS: Record<PreparationStatus, string> = {
  ready: "준비 완료",
  in_progress: "준비 중",
  action_required: "조치 필요",
  needs_information: "확인 필요",
};
