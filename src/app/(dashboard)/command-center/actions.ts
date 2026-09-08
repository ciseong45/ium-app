"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { buildInboxDedupeKey, todayInTimeZone } from "@/lib/command-center";
import type { ActionResult } from "@/lib/validations";
import type {
  CommandCenterData,
  DecisionStatus,
  MinistryArea,
  MinistryKind,
  MinistryStatus,
  OccurrenceStatus,
  ResourceVersionStatus,
  TaskStatus,
} from "@/types/command-center";

const COMMAND_CENTER_PATH = "/command-center";
const PRIVATE_ERROR = "개인 총괄 공간은 관리자만 사용할 수 있습니다.";

type SupabaseClient = Awaited<ReturnType<typeof requireAuth>>["supabase"];

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function nullable(formData: FormData, key: string) {
  return value(formData, key) || null;
}

function refresh() {
  revalidatePath(COMMAND_CENTER_PATH);
}

async function commandCenterAuth(): Promise<
  | { ok: true; supabase: SupabaseClient; ownerId: string }
  | { ok: false; result: ActionResult }
> {
  const { supabase, user, role } = await requireAuth();
  if (role !== "admin") {
    return { ok: false, result: { success: false, error: PRIVATE_ERROR } };
  }
  return { ok: true, supabase, ownerId: user.id };
}

export async function getCommandCenterData(): Promise<CommandCenterData> {
  const auth = await commandCenterAuth();
  const empty: CommandCenterData = {
    ready: false,
    seasons: [],
    ministries: [],
    occurrences: [],
    tasks: [],
    followups: [],
    decisions: [],
    resources: [],
    inbox: [],
    weeklyReviews: [],
  };
  if (!auth.ok) return { ...empty, error: PRIVATE_ERROR };

  const { supabase, ownerId } = auth;
  const [
    seasons,
    ministries,
    occurrences,
    tasks,
    followups,
    decisions,
    resources,
    inbox,
    weeklyReviews,
  ] = await Promise.all([
    supabase.from("cc_seasons").select("*").eq("owner_id", ownerId).is("archived_at", null).order("start_date", { ascending: false }),
    supabase.from("cc_ministries").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false }),
    supabase.from("cc_occurrences").select("*").eq("owner_id", ownerId).order("date_only", { ascending: true }),
    supabase.from("cc_tasks").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false }),
    supabase.from("cc_followups").select("*").eq("owner_id", ownerId).order("next_check_date", { ascending: true }),
    supabase.from("cc_decisions").select("*").eq("owner_id", ownerId).order("due_date", { ascending: true }),
    supabase.from("cc_resources").select("*").eq("owner_id", ownerId).order("updated_at", { ascending: false }),
    supabase.from("cc_inbox").select("*").eq("owner_id", ownerId).order("received_at", { ascending: false }),
    supabase.from("cc_weekly_reviews").select("*").eq("owner_id", ownerId).order("week_start", { ascending: false }).limit(8),
  ]);

  const results = [seasons, ministries, occurrences, tasks, followups, decisions, resources, inbox, weeklyReviews];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    return {
      ...empty,
      error: firstError.code === "42P01"
        ? "개인 총괄 저장소를 먼저 연결해주세요."
        : "개인 총괄 기록을 불러오지 못했습니다.",
    };
  }

  return {
    ready: true,
    seasons: (seasons.data ?? []) as CommandCenterData["seasons"],
    ministries: (ministries.data ?? []) as CommandCenterData["ministries"],
    occurrences: (occurrences.data ?? []) as CommandCenterData["occurrences"],
    tasks: (tasks.data ?? []) as CommandCenterData["tasks"],
    followups: (followups.data ?? []) as CommandCenterData["followups"],
    decisions: (decisions.data ?? []) as CommandCenterData["decisions"],
    resources: (resources.data ?? []) as CommandCenterData["resources"],
    inbox: (inbox.data ?? []) as CommandCenterData["inbox"],
    weeklyReviews: (weeklyReviews.data ?? []) as CommandCenterData["weeklyReviews"],
  };
}

export async function createInboxItem(formData: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const content = value(formData, "content");
  if (!content) return { success: false, error: "내용을 입력해주세요." };

  const dedupeKey = buildInboxDedupeKey(content);
  const duplicate = await auth.supabase
    .from("cc_inbox")
    .select("id")
    .eq("owner_id", auth.ownerId)
    .eq("dedupe_key", dedupeKey)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (duplicate.data) {
    return { success: false, error: "같은 내용이 이미 수집함에 있습니다." };
  }

  const { error } = await auth.supabase.from("cc_inbox").insert({
    owner_id: auth.ownerId,
    original_text: content,
    received_at: nullable(formData, "received_at") ?? new Date().toISOString(),
    source: nullable(formData, "source"),
    attachment_url: nullable(formData, "attachment_url"),
    status: "unprocessed",
    dedupe_key: dedupeKey,
  });
  if (error) return { success: false, error: "수집 기록 저장에 실패했습니다." };
  refresh();
  return { success: true };
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const title = value(formData, "title");
  const status = (value(formData, "status") || "planned") as TaskStatus;
  const nextAction = nullable(formData, "next_action");
  if (!title) return { success: false, error: "업무 제목을 입력해주세요." };
  if (["in_progress", "waiting"].includes(status) && !nextAction) {
    return { success: false, error: "다음 행동을 입력해주세요." };
  }

  const { error } = await auth.supabase.from("cc_tasks").insert({
    owner_id: auth.ownerId,
    title,
    area: (value(formData, "area") || "admin_finance") as MinistryArea,
    status,
    next_action: nextAction,
    completion_criteria: nullable(formData, "completion_criteria"),
    due_date: nullable(formData, "due_date"),
    scheduled_date: nullable(formData, "scheduled_date"),
    priority: Number(value(formData, "priority") || "2"),
    is_required: formData.get("is_required") === "true",
    due_date_is_manual: Boolean(value(formData, "due_date")),
    ministry_id: nullable(formData, "ministry_id"),
    occurrence_id: nullable(formData, "occurrence_id"),
    source_inbox_id: nullable(formData, "source_inbox_id"),
  });
  if (error) return { success: false, error: "업무 저장에 실패했습니다." };
  refresh();
  return { success: true };
}

export async function processInboxToTask(inboxId: string, formData: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const title = value(formData, "title");
  const nextAction = value(formData, "next_action");
  if (!title || !nextAction) {
    return { success: false, error: "업무 제목과 다음 행동을 입력해주세요." };
  }
  const { error } = await auth.supabase.rpc("cc_inbox_to_task", {
    p_inbox_id: inboxId,
    p_title: title,
    p_next_action: nextAction,
    p_area: value(formData, "area") || "admin_finance",
    p_due_date: nullable(formData, "due_date"),
    p_ministry_id: nullable(formData, "ministry_id"),
  });
  if (error) return { success: false, error: "수집 기록을 업무로 바꾸지 못했습니다." };
  refresh();
  return { success: true };
}

export async function createMinistry(formData: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const title = value(formData, "title");
  if (!title) return { success: false, error: "사역 이름을 입력해주세요." };
  const { error } = await auth.supabase.from("cc_ministries").insert({
    owner_id: auth.ownerId,
    season_id: nullable(formData, "season_id"),
    title,
    area: (value(formData, "area") || "community_events") as MinistryArea,
    kind: (value(formData, "kind") || "project") as MinistryKind,
    status: (value(formData, "status") || "planned") as MinistryStatus,
    purpose: nullable(formData, "purpose"),
    start_date: nullable(formData, "start_date"),
    end_date: nullable(formData, "end_date"),
    current_blocker: nullable(formData, "current_blocker"),
    source_url: nullable(formData, "source_url"),
  });
  if (error) return { success: false, error: "사역 저장에 실패했습니다." };
  refresh();
  return { success: true };
}

export async function createOccurrence(formData: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const title = value(formData, "title");
  const ministryId = value(formData, "ministry_id");
  const date = value(formData, "date_only");
  if (!title || !ministryId || !date) {
    return { success: false, error: "일정명, 사역, 날짜를 입력해주세요." };
  }
  const { error } = await auth.supabase.from("cc_occurrences").insert({
    owner_id: auth.ownerId,
    ministry_id: ministryId,
    title,
    status: (value(formData, "status") || "tentative") as OccurrenceStatus,
    date_only: date,
    starts_at: nullable(formData, "starts_at"),
    ends_at: nullable(formData, "ends_at"),
    timezone: "America/New_York",
    location: nullable(formData, "location"),
    sequence_label: nullable(formData, "sequence_label"),
  });
  if (error) return { success: false, error: "일정 저장에 실패했습니다." };
  refresh();
  return { success: true };
}

export async function createDecision(formData: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const question = value(formData, "question");
  if (!question) return { success: false, error: "결정할 질문을 입력해주세요." };
  const options = value(formData, "options")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const { error } = await auth.supabase.from("cc_decisions").insert({
    owner_id: auth.ownerId,
    ministry_id: nullable(formData, "ministry_id"),
    question,
    status: "open" as DecisionStatus,
    options,
    required_information: nullable(formData, "required_information"),
    due_date: nullable(formData, "due_date"),
  });
  if (error) return { success: false, error: "결정 기록 저장에 실패했습니다." };
  refresh();
  return { success: true };
}

export async function decide(decisionId: string, formData: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const choice = value(formData, "confirmed_choice");
  if (!choice) return { success: false, error: "확정 내용을 입력해주세요." };
  const { error } = await auth.supabase
    .from("cc_decisions")
    .update({
      status: "decided",
      confirmed_choice: choice,
      basis: nullable(formData, "basis"),
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", decisionId)
    .eq("owner_id", auth.ownerId);
  if (error) return { success: false, error: "결정을 확정하지 못했습니다." };
  refresh();
  return { success: true };
}

export async function createResource(formData: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const title = value(formData, "title");
  const sourceUrl = value(formData, "source_url");
  if (!title || !sourceUrl) return { success: false, error: "자료 제목과 원본 위치를 입력해주세요." };
  const { error } = await auth.supabase.from("cc_resources").insert({
    owner_id: auth.ownerId,
    ministry_id: nullable(formData, "ministry_id"),
    title,
    source_url: sourceUrl,
    resource_type: value(formData, "resource_type") || "문서",
    version_status: (value(formData, "version_status") || "draft") as ResourceVersionStatus,
    reference_date: nullable(formData, "reference_date"),
    verified_at: value(formData, "verified") === "true" ? new Date().toISOString() : null,
    access_scope: nullable(formData, "access_scope"),
  });
  if (error) return { success: false, error: "자료 저장에 실패했습니다." };
  refresh();
  return { success: true };
}

export async function startWaiting(taskId: string, formData: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const person = value(formData, "person");
  const request = value(formData, "request");
  const nextCheckDate = value(formData, "next_check_date");
  if (!person || !request || !nextCheckDate) {
    return { success: false, error: "요청 상대, 요청 내용, 다음 확인일을 입력해주세요." };
  }
  const { error } = await auth.supabase.rpc("cc_start_waiting", {
    p_task_id: taskId,
    p_person_label: person,
    p_request_text: request,
    p_requested_at: value(formData, "requested_at") || todayInTimeZone(),
    p_next_check_date: nextCheckDate,
  });
  if (error) return { success: false, error: "응답 대기 상태로 바꾸지 못했습니다." };
  refresh();
  return { success: true };
}

export async function recordFollowupResponse(followupId: string, formData: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const response = value(formData, "response");
  const nextAction = value(formData, "next_action");
  if (!response || !nextAction) {
    return { success: false, error: "받은 답과 다음 행동을 입력해주세요." };
  }
  const { error } = await auth.supabase.rpc("cc_record_followup_response", {
    p_followup_id: followupId,
    p_response_text: response,
    p_next_action: nextAction,
  });
  if (error) return { success: false, error: "답변을 기록하지 못했습니다." };
  refresh();
  return { success: true };
}

export async function transitionTask(taskId: string, nextStatus: TaskStatus, formData?: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const note = formData ? value(formData, "note") : "";
  const nextAction = formData ? nullable(formData, "next_action") : null;
  if (nextStatus === "completed" && !note) {
    return { success: false, error: "완료 기준을 충족한 근거나 직접 확인 메모를 입력해주세요." };
  }
  if (["on_hold", "cancelled"].includes(nextStatus) && !note) {
    return { success: false, error: "변경 이유를 입력해주세요." };
  }
  const { error } = await auth.supabase.rpc("cc_transition_task", {
    p_task_id: taskId,
    p_next_status: nextStatus,
    p_note: note || null,
    p_next_action: nextAction,
  });
  if (error) return { success: false, error: error.message || "업무 상태를 변경하지 못했습니다." };
  refresh();
  return { success: true };
}

export async function setTodayFocus(taskId: string, enabled: boolean): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  let order: number | null = null;
  if (enabled) {
    const selected = await auth.supabase
      .from("cc_tasks")
      .select("id, today_focus_order")
      .eq("owner_id", auth.ownerId)
      .not("today_focus_order", "is", null)
      .is("archived_at", null)
      .limit(3);
    if ((selected.data ?? []).length >= 3) {
      return { success: false, error: "오늘 끝낼 결과물은 최대 3개까지 선택할 수 있습니다." };
    }
    const used = new Set((selected.data ?? []).map((item) => item.today_focus_order));
    order = [1, 2, 3].find((candidate) => !used.has(candidate)) ?? null;
  }
  const { error } = await auth.supabase
    .from("cc_tasks")
    .update({ today_focus_order: order, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("owner_id", auth.ownerId);
  if (error) return { success: false, error: "오늘 결과물 선택을 저장하지 못했습니다." };
  refresh();
  return { success: true };
}

const ARCHIVE_TABLES = {
  task: "cc_tasks",
  ministry: "cc_ministries",
  occurrence: "cc_occurrences",
  decision: "cc_decisions",
  resource: "cc_resources",
  inbox: "cc_inbox",
} as const;

export async function setArchived(
  kind: keyof typeof ARCHIVE_TABLES,
  id: string,
  archived: boolean
): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const { error } = await auth.supabase
    .from(ARCHIVE_TABLES[kind])
    .update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", auth.ownerId);
  if (error) return { success: false, error: "보관 상태를 변경하지 못했습니다." };
  refresh();
  return { success: true };
}

export async function saveWeeklyReview(formData: FormData): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const weekStart = value(formData, "week_start");
  if (!weekStart) return { success: false, error: "점검 주간을 선택해주세요." };
  const focusTaskIds = formData.getAll("focus_task_ids").filter((item): item is string => typeof item === "string").slice(0, 3);
  const { error } = await auth.supabase.from("cc_weekly_reviews").upsert({
    owner_id: auth.ownerId,
    week_start: weekStart,
    reviewed_at: new Date().toISOString(),
    focus_task_ids: focusTaskIds,
    incomplete_judgment: nullable(formData, "incomplete_judgment"),
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id,week_start" });
  if (error) return { success: false, error: "주간 점검을 저장하지 못했습니다." };
  refresh();
  return { success: true };
}

export async function bootstrapFallPlan(): Promise<ActionResult> {
  const auth = await commandCenterAuth();
  if (!auth.ok) return auth.result;
  const { error } = await auth.supabase.rpc("cc_bootstrap_2026_fall");
  if (error) return { success: false, error: "2026 가을 기준 자료를 불러오지 못했습니다." };
  refresh();
  return { success: true };
}
