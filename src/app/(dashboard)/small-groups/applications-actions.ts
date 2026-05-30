"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";

export interface Application {
  id: number;
  season_id: number;
  member_id: number | null;
  name: string;
  phone: string | null;
  source: "form" | "admin";
  status: "pending" | "assigned" | "cancelled";
  assigned_group_id: number | null;
  note: string | null;
  applied_at: string;
}

export async function getPool(seasonId: number): Promise<Application[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("small_group_applications")
    .select("id, season_id, member_id, name, phone, source, status, assigned_group_id, note, applied_at")
    .eq("season_id", seasonId)
    .eq("status", "pending")
    .order("applied_at");
  if (error) return [];
  return data ?? [];
}

export async function addApplication(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  const seasonIdRaw = formData.get("season_id") as string;
  const seasonId = parseInt(seasonIdRaw, 10);
  if (!seasonIdRaw || isNaN(seasonId)) return { success: false, error: "시즌 정보가 없습니다." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { success: false, error: "이름은 필수입니다." };

  const phone = (formData.get("phone") as string)?.trim() || null;
  const memberIdRaw = formData.get("member_id") as string;
  const memberId = memberIdRaw ? parseInt(memberIdRaw, 10) : null;
  const source = (formData.get("source") as "form" | "admin") || "admin";
  const note = (formData.get("note") as string)?.trim() || null;

  const { error } = await supabase
    .from("small_group_applications")
    .insert({ season_id: seasonId, member_id: memberId, name, phone, source, note });

  if (error) return { success: false, error: "신청 추가에 실패했습니다." };
  revalidatePath("/small-groups");
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

export async function assignFromPool({
  applicationId,
  groupId,
  memberId,
  seasonId,
}: {
  applicationId: number;
  groupId: number;
  memberId: number | null;
  seasonId: number;
}): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  // 기존 멤버면 small_group_members에 배정
  if (memberId !== null) {
    const { error: insertError } = await supabase
      .from("small_group_members")
      .insert({ group_id: groupId, member_id: memberId });
    if (insertError) return { success: false, error: "멤버 배정에 실패했습니다." };
  }

  // 신청 상태 업데이트
  const { error: updateError } = await supabase
    .from("small_group_applications")
    .update({ status: "assigned", assigned_group_id: groupId })
    .eq("id", applicationId);
  if (updateError) return { success: false, error: "신청 상태 업데이트에 실패했습니다." };

  revalidatePath("/small-groups");
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

export async function cancelAssignment({
  applicationId,
  groupId,
  memberId,
  seasonId,
}: {
  applicationId: number;
  groupId: number;
  memberId: number | null;
  seasonId: number;
}): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  if (memberId !== null) {
    const { error: deleteError } = await supabase
      .from("small_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("member_id", memberId);
    if (deleteError) return { success: false, error: "배정 취소에 실패했습니다." };
  }

  const { error: updateError } = await supabase
    .from("small_group_applications")
    .update({ status: "pending", assigned_group_id: null })
    .eq("id", applicationId);
  if (updateError) return { success: false, error: "신청 상태 복원에 실패했습니다." };

  revalidatePath("/small-groups");
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

export async function cancelApplication(applicationId: number, seasonId: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase
    .from("small_group_applications")
    .update({ status: "cancelled" })
    .eq("id", applicationId);
  if (error) return { success: false, error: "취소에 실패했습니다." };

  revalidatePath("/small-groups");
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}
