"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";
import { fetchActiveMembers } from "@/lib/queries";
import type { OneToOneStatus, OneToOneEntry, SessionEntry } from "@/types/one-to-one";

export async function getOneToOnes(status?: string) {
  const { supabase } = await requireAuth();
  let query = supabase
    .from("one_to_one")
    .select(
      "*, mentor:members!mentor_id(id, name), mentee:members!mentee_id(id, name)"
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return [] as OneToOneEntry[];
  return data as OneToOneEntry[];
}

export async function createOneToOne(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "viewer") return { success: false, error: "권한이 없습니다." };

  const mentorId = Number(formData.get("mentor_id"));
  const menteeId = Number(formData.get("mentee_id"));

  if (!mentorId || !menteeId) return { success: false, error: "멘토와 멘티를 선택해주세요." };
  if (mentorId === menteeId) return { success: false, error: "멘토와 멘티는 다른 사람이어야 합니다." };

  const { error } = await supabase.from("one_to_one").insert({
    mentor_id: mentorId,
    mentee_id: menteeId,
    started_at: (formData.get("started_at") as string) || new Date().toISOString().split("T")[0],
  });
  if (error) return { success: false, error: "양육 등록에 실패했습니다." };
  revalidatePath("/one-to-one");
  return { success: true };
}

export async function updateOneToOneStatus(id: number, status: OneToOneStatus): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "viewer") return { success: false, error: "권한이 없습니다." };
  const updates: Record<string, unknown> = { status };
  if (status === "completed") {
    updates.completed_at = new Date().toISOString().split("T")[0];
  }
  const { error } = await supabase
    .from("one_to_one")
    .update(updates)
    .eq("id", id);
  if (error) return { success: false, error: "상태 변경에 실패했습니다." };
  revalidatePath("/one-to-one");
  return { success: true };
}

export async function deleteOneToOne(id: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase.from("one_to_one").delete().eq("id", id);
  if (error) return { success: false, error: "삭제에 실패했습니다." };
  revalidatePath("/one-to-one");
  return { success: true };
}

export async function getSessions(oneToOneId: number) {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("one_to_one_sessions")
    .select("*")
    .eq("one_to_one_id", oneToOneId)
    .order("session_number", { ascending: true });
  if (error) return [] as SessionEntry[];
  return data as SessionEntry[];
}

export async function addSession(oneToOneId: number, formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "viewer") return { success: false, error: "권한이 없습니다." };

  // 다음 회차 번호 계산
  const { data: existing } = await supabase
    .from("one_to_one_sessions")
    .select("session_number")
    .eq("one_to_one_id", oneToOneId)
    .order("session_number", { ascending: false })
    .limit(1);

  const nextNumber = existing && existing.length > 0 ? existing[0].session_number + 1 : 1;

  const { error } = await supabase.from("one_to_one_sessions").insert({
    one_to_one_id: oneToOneId,
    session_date:
      (formData.get("session_date") as string) ||
      new Date().toISOString().split("T")[0],
    session_number: nextNumber,
    notes: (formData.get("notes") as string) || null,
  });

  if (error) return { success: false, error: "세션 추가에 실패했습니다." };
  revalidatePath("/one-to-one");
  return { success: true };
}

export async function deleteSession(sessionId: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase
    .from("one_to_one_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) return { success: false, error: "세션 삭제에 실패했습니다." };
  revalidatePath("/one-to-one");
  return { success: true };
}

export async function getActiveMembers() {
  const { supabase } = await requireAuth();
  return fetchActiveMembers(supabase, ["active", "attending"]);
}
