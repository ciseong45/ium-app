"use server";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { careCreateSchema, careChangeSchema } from "@/lib/care";
import type { CareAction, CareEvent, CarePerson } from "@/lib/care";
import type { ActionResult } from "@/lib/validations";

export async function getCareData(memberId?: number) {
  const { supabase, user, role } = await requireAuth();
  let query = supabase.from("care_actions").select("*, member:members!member_id(last_name, first_name)").order("due_date");
  if (memberId) query = query.eq("member_id", memberId);
  // RLS limits rows to the admin, creator, current assignee and requested assignee.
  const [actions, people] = await Promise.all([
    query,
    supabase.from("profiles").select("id, name").in("role", ["admin", "upper_room_leader", "group_leader"]).order("name"),
  ]);
  if (actions.error || people.error) throw new Error("돌봄 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  const ids = (actions.data ?? []).map(a => a.id);
  const events = ids.length ? await supabase.from("care_action_events").select("*").in("action_id", ids).order("created_at", { ascending: false }) : { data: [], error: null };
  if (events.error) throw new Error("처리 이력을 불러오지 못했습니다.");
  return { actions: (actions.data ?? []) as CareAction[], people: (people.data ?? []) as CarePerson[], events: (events.data ?? []) as CareEvent[], userId: user.id, isAdmin: role === "admin" };
}
function refresh() { revalidatePath("/care"); revalidatePath("/"); revalidatePath("/members/[id]", "page"); }
export async function createCareAction(input: unknown): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "관리자만 새 돌봄 조치를 등록할 수 있습니다." };
  const parsed = careCreateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "대상자, 할 일, 기한을 확인하세요." };
  const d = parsed.data;
  const { error } = await supabase.rpc("create_care_action", { p_member_id: d.memberId, p_next_action: d.nextAction, p_due_date: d.dueDate, p_assignee: d.assigneeId });
  if (error) return { success: false, error: "등록하지 못했습니다. 담당자와 입력 내용을 확인하세요." };
  refresh(); return { success: true };
}
export async function changeCareAction(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  const parsed = careChangeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "입력 내용을 확인하세요." };
  const d = parsed.data;
  const { error } = await supabase.rpc("change_care_action", { p_id: d.id, p_version: d.version, p_operation: d.operation, p_note: d.note, p_target: d.targetId ?? null, p_due_date: d.dueDate ?? null });
  if (error) return { success: false, error: error.message === "CARE_CONFLICT" ? "다른 담당자가 먼저 변경했습니다. 새로고침 후 다시 확인하세요." : "처리하지 못했습니다. 담당 권한과 입력 내용을 확인하세요." };
  refresh(); return { success: true };
}
