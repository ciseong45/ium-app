"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Season = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type NewFamilyEntry = {
  id: number;
  member_id: number;
  first_visit: string;
  step: number;
  step_updated_at: string;
  assigned_to: number | null;
  season_id: number | null;
  notes: string | null;
  created_at: string;
  member: { id: number; name: string; phone: string | null };
  assignee: { id: number; name: string } | null;
};

export async function getSeasons() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("small_group_seasons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Season[];
}

export async function getNewFamilies(seasonId?: number) {
  const supabase = await createClient();
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
  if (error) throw error;
  return data as NewFamilyEntry[];
}

export async function createNewFamily(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const phone = (formData.get("phone") as string) || null;
  const firstVisit = formData.get("first_visit") as string;
  const assignedTo = formData.get("assigned_to") as string;

  // 먼저 멤버 등록
  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({ name, phone, status: "active" })
    .select("id")
    .single();

  if (memberError) throw memberError;

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

  if (error) throw error;
  revalidatePath("/new-family");
  return { success: true };
}

export async function updateStep(id: number, step: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("new_family")
    .update({ step, step_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  // 3주차 교육 완료 시 멤버 상태를 attending(출석)으로 자동 전환
  if (step === 3) {
    const { data: family } = await supabase
      .from("new_family")
      .select("member_id")
      .eq("id", id)
      .single();

    if (family) {
      // 현재 멤버 상태 확인
      const { data: member } = await supabase
        .from("members")
        .select("status")
        .eq("id", family.member_id)
        .single();

      if (member && member.status !== "attending") {
        // 멤버 상태를 attending으로 변경
        await supabase
          .from("members")
          .update({ status: "attending" })
          .eq("id", family.member_id);

        // 상태 변경 이력 기록
        const {
          data: { user },
        } = await supabase.auth.getUser();

        await supabase.from("member_status_log").insert({
          member_id: family.member_id,
          old_status: member.status,
          new_status: "attending",
          changed_by: user?.id,
        });
      }
    }
  }

  revalidatePath("/new-family");
  revalidatePath("/members");
  return { success: true };
}

export async function updateAssignee(id: number, assignedTo: number | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("new_family")
    .update({ assigned_to: assignedTo })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/new-family");
  return { success: true };
}

export async function deleteNewFamily(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("new_family").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/new-family");
  return { success: true };
}

export async function getActiveMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, name")
    .in("status", ["active", "attending"])
    .order("name");
  if (error) throw error;
  return data;
}
