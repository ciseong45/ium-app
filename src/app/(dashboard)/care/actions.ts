"use server";

import { requireAuth } from "@/lib/auth";
import { addDays, todayInTimeZone } from "@/lib/command-center";
import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import type {
  CareDashboardData,
  CareDashboardItem,
  CareLogItem,
  MemberCareData,
} from "@/types/care";

const followupSchema = z.object({
  care_case_id: z.string().uuid().nullable(),
  contact_method: z.enum(["message", "phone", "in_person", "other"]),
  outcome: z.enum(["connected", "awaiting_response", "scheduling"]),
  note: z.string().trim().max(800, "메모는 800자 이내로 입력해주세요.").nullable(),
  visibility: z.enum(["assigned_leaders", "pastoral_only"]),
  next_action: z.string().trim().min(1, "다음 행동을 입력해주세요.").max(180, "다음 행동은 180자 이내로 입력해주세요."),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "다음 행동의 확인 날짜를 입력해주세요."),
});

type CaseRow = {
  id: string;
  member_id: number;
  case_type: CareDashboardItem["caseType"];
  status: CareDashboardItem["status"];
  next_action: string;
  due_date: string;
  assigned_to: string | null;
  last_contact_at: string | null;
};

type LogRow = {
  id: string;
  care_case_id: string;
  contact_method: CareLogItem["contactMethod"];
  outcome: CareLogItem["outcome"];
  note: string | null;
  visibility: CareLogItem["visibility"];
  contacted_at: string;
  created_by: string | null;
};

function message(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "입력값을 확인해주세요.";
  return "입력값을 확인해주세요.";
}

async function decorateCases(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  rows: CaseRow[]
): Promise<CareDashboardItem[]> {
  if (rows.length === 0) return [];

  const memberIds = [...new Set(rows.map((row) => row.member_id))];
  const assigneeIds = [...new Set(rows.map((row) => row.assigned_to).filter((id): id is string => Boolean(id)))];
  const [{ data: members }, { data: profiles }] = await Promise.all([
    supabase.from("members").select("id, last_name, first_name").in("id", memberIds),
    assigneeIds.length
      ? supabase.from("profiles").select("id, name, email").in("id", assigneeIds)
      : Promise.resolve({ data: [] }),
  ]);
  const memberNames = new Map(
    (members ?? []).map((member: { id: number; last_name: string; first_name: string }) => [
      member.id,
      `${member.last_name}${member.first_name}`,
    ])
  );
  const assigneeNames = new Map(
    (profiles ?? []).map((profile: { id: string; name: string | null; email: string | null }) => [
      profile.id,
      profile.name?.trim() || profile.email?.split("@")[0] || "담당자",
    ])
  );

  return rows.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    memberName: memberNames.get(row.member_id) ?? "이름 확인 필요",
    caseType: row.case_type,
    status: row.status,
    nextAction: row.next_action,
    dueDate: row.due_date,
    assigneeName: row.assigned_to ? assigneeNames.get(row.assigned_to) ?? "담당자 확인 필요" : "담당자 없음",
    lastContactAt: row.last_contact_at,
  }));
}

export async function getCareDashboard(today = todayInTimeZone()): Promise<CareDashboardData> {
  const { supabase, user, role } = await requireAuth();
  let query = supabase
    .from("care_cases")
    .select("id, member_id, case_type, status, next_action, due_date, assigned_to, last_contact_at")
    .neq("status", "closed")
    .lte("due_date", addDays(today, 7))
    .order("due_date", { ascending: true })
    .limit(30);

  if (role !== "admin") query = query.eq("assigned_to", user.id);
  const { data, error } = await query;
  if (error) return { items: [], errors: ["돌봄 목록"] };

  return { items: await decorateCases(supabase, (data ?? []) as CaseRow[]), errors: [] };
}

export async function getMemberCare(memberId: number): Promise<MemberCareData> {
  const { supabase } = await requireAuth();
  const { data: cases, error: casesError } = await supabase
    .from("care_cases")
    .select("id, member_id, case_type, status, next_action, due_date, assigned_to, last_contact_at")
    .eq("member_id", memberId)
    .neq("status", "closed")
    .order("due_date", { ascending: true });

  if (casesError) return { openCases: [], logs: [], errors: ["목양 정보"] };
  const caseRows = (cases ?? []) as CaseRow[];
  const openCases = await decorateCases(supabase, caseRows);
  if (caseRows.length === 0) return { openCases, logs: [], errors: [] };

  const caseIds = caseRows.map((row) => row.id);
  const { data: logs, error: logsError } = await supabase
    .from("care_logs")
    .select("id, care_case_id, contact_method, outcome, note, visibility, contacted_at, created_by")
    .in("care_case_id", caseIds)
    .order("contacted_at", { ascending: false })
    .limit(30);
  if (logsError) return { openCases, logs: [], errors: ["돌봄 이력"] };

  const logRows = (logs ?? []) as LogRow[];
  const authorIds = [...new Set(logRows.map((row) => row.created_by).filter((id): id is string => Boolean(id)))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, name, email").in("id", authorIds)
    : { data: [] };
  const authorNames = new Map(
    (authors ?? []).map((profile: { id: string; name: string | null; email: string | null }) => [
      profile.id,
      profile.name?.trim() || profile.email?.split("@")[0] || "작성자",
    ])
  );
  const mappedLogs: CareLogItem[] = logRows.map((row) => ({
    id: row.id,
    careCaseId: row.care_case_id,
    contactedAt: row.contacted_at,
    authorName: row.created_by ? authorNames.get(row.created_by) ?? "작성자 확인 필요" : "이전 담당자",
    contactMethod: row.contact_method,
    outcome: row.outcome,
    note: row.note,
    visibility: row.visibility,
  }));
  return { openCases, logs: mappedLogs, errors: [] };
}

export async function recordCareFollowup(
  memberId: number,
  formData: FormData
): Promise<{ success: true; data: { caseId: string } } | { success: false; error: string }> {
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return { success: false, error: "성도 정보를 확인해주세요." };
  }

  try {
    const dueDate = (formData.get("due_date") as string | null)?.trim() ?? "";
    if (!dueDate) return { success: false, error: "다음 행동의 확인 날짜를 입력해주세요." };
    const visibility = formData.get("visibility");
    if (visibility !== "assigned_leaders" && visibility !== "pastoral_only") {
      return { success: false, error: "사용할 수 없는 공개 범위입니다." };
    }

    const input = followupSchema.parse({
      care_case_id: (formData.get("care_case_id") as string | null)?.trim() || null,
      contact_method: formData.get("contact_method"),
      outcome: formData.get("outcome"),
      note: (formData.get("note") as string | null)?.trim() || null,
      visibility,
      next_action: formData.get("next_action"),
      due_date: dueDate,
    });
    const { supabase } = await requireAuth();
    const { data, error } = await supabase.rpc("record_care_followup", {
      p_member_id: memberId,
      p_case_id: input.care_case_id,
      p_contact_method: input.contact_method,
      p_outcome: input.outcome,
      p_note: input.note,
      p_visibility: input.visibility,
      p_next_action: input.next_action,
      p_due_date: input.due_date,
    });
    if (error || !data) return { success: false, error: "돌봄 기록을 저장하지 못했습니다." };

    revalidatePath("/");
    revalidatePath(`/members/${memberId}`);
    return { success: true, data: { caseId: data as string } };
  } catch (error) {
    return { success: false, error: message(error) };
  }
}
