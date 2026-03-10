"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";
import { insertStatusLog, fetchActiveMembers } from "@/lib/queries";
import type { Season, NewFamilyEntry } from "@/types/new-family";

export async function getSeasons() {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("small_group_seasons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [] as Season[];
  return data as Season[];
}

export async function getNewFamilies(seasonId?: number) {
  const { supabase } = await requireAuth();
  let query = supabase
    .from("new_family")
    .select(
      "*, member:members!member_id(id, name, phone), assignee:members!assigned_to(id, name)"
    )
    .order("step", { ascending: true })
    .order("created_at", { ascending: false });

  if (seasonId) {
    query = query.eq("season_id", seasonId);
  }

  const { data, error } = await query;
  if (error) return [] as NewFamilyEntry[];
  return data as NewFamilyEntry[];
}

export async function createNewFamily(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { success: false, error: "이름은 필수입니다." };

  const phone = (formData.get("phone") as string) || null;
  const firstVisit = formData.get("first_visit") as string;
  const assignedTo = formData.get("assigned_to") as string;

  if (!firstVisit) return { success: false, error: "첫 방문일은 필수입니다." };

  // 먼저 멤버 등록
  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({ name, phone, status: "new_family" })
    .select("id")
    .single();

  if (memberError) return { success: false, error: "멤버 등록에 실패했습니다." };

  // 활성 시즌 가져오기
  const { data: activeSeason } = await supabase
    .from("small_group_seasons")
    .select("id")
    .eq("is_active", true)
    .single();

  // 새가족 등록
  const { error } = await supabase.from("new_family").insert({
    member_id: member.id,
    first_visit: firstVisit,
    assigned_to: assignedTo ? Number(assignedTo) : null,
    season_id: activeSeason?.id || null,
  });

  if (error) return { success: false, error: "새가족 등록에 실패했습니다." };
  revalidatePath("/new-family");
  return { success: true };
}

export async function updateStep(id: number, step: number): Promise<ActionResult> {
  const { supabase, user, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  if (step < 1 || step > 3) return { success: false, error: "잘못된 단계입니다." };

  const { error } = await supabase
    .from("new_family")
    .update({ step, step_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: "단계 변경에 실패했습니다." };

  // 3주차 교육 완료 시 멤버 상태를 adjusting(적응중)으로 자동 전환
  if (step === 3) {
    const { data: family } = await supabase
      .from("new_family")
      .select("member_id")
      .eq("id", id)
      .single();

    if (family) {
      const { data: member } = await supabase
        .from("members")
        .select("status")
        .eq("id", family.member_id)
        .single();

      if (member && member.status === "new_family") {
        await supabase
          .from("members")
          .update({ status: "adjusting" })
          .eq("id", family.member_id);

        await insertStatusLog(supabase, family.member_id, member.status, "adjusting", user.id);
      }
    }
  }

  revalidatePath("/new-family");
  revalidatePath("/members");
  return { success: true };
}

export async function updateAssignee(id: number, assignedTo: number | null): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase
    .from("new_family")
    .update({ assigned_to: assignedTo })
    .eq("id", id);
  if (error) return { success: false, error: "담당자 변경에 실패했습니다." };
  revalidatePath("/new-family");
  return { success: true };
}

export async function deleteNewFamily(id: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase.from("new_family").delete().eq("id", id);
  if (error) return { success: false, error: "삭제에 실패했습니다." };
  revalidatePath("/new-family");
  return { success: true };
}

export async function getActiveMembers() {
  const { supabase } = await requireAuth();
  return fetchActiveMembers(supabase, ["active", "attending", "adjusting"]);
}
