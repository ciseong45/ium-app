"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ===== 시즌 =====

export async function getSeasons() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("small_group_seasons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getActiveSeason() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("small_group_seasons")
    .select("*")
    .eq("is_active", true)
    .single();
  return data;
}

export async function createSeason(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("small_group_seasons").insert({
    name: formData.get("name") as string,
    start_date: (formData.get("start_date") as string) || null,
    end_date: (formData.get("end_date") as string) || null,
    is_active: formData.get("is_active") === "on",
  });
  if (error) throw error;
  revalidatePath("/small-groups");
  return { success: true };
}

export async function updateSeason(id: number, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("small_group_seasons")
    .update({
      name: formData.get("name") as string,
      start_date: (formData.get("start_date") as string) || null,
      end_date: (formData.get("end_date") as string) || null,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/small-groups");
  return { success: true };
}

export async function deleteSeason(id: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("small_group_seasons")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/small-groups");
  return { success: true };
}

// ===== 소그룹 =====

export async function getGroupsBySeason(seasonId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("small_groups")
    .select("*, leader:members!leader_id(id, name)")
    .eq("season_id", seasonId)
    .order("name");
  if (error) throw error;
  return data;
}

export async function createGroup(seasonId: number, formData: FormData) {
  const supabase = await createClient();
  const leaderId = formData.get("leader_id") as string;
  const { error } = await supabase.from("small_groups").insert({
    season_id: seasonId,
    name: formData.get("name") as string,
    leader_id: leaderId ? Number(leaderId) : null,
  });
  if (error) throw error;
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

export async function updateGroup(groupId: number, seasonId: number, formData: FormData) {
  const supabase = await createClient();
  const leaderId = formData.get("leader_id") as string;
  const { error } = await supabase
    .from("small_groups")
    .update({
      name: formData.get("name") as string,
      leader_id: leaderId ? Number(leaderId) : null,
    })
    .eq("id", groupId);
  if (error) throw error;
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

export async function deleteGroup(groupId: number, seasonId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("small_groups")
    .delete()
    .eq("id", groupId);
  if (error) throw error;
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

// ===== 멤버 배정 =====

export async function getGroupMembers(groupId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("small_group_members")
    .select("*, member:members(*)")
    .eq("group_id", groupId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function getUnassignedMembers(seasonId: number) {
  const supabase = await createClient();

  // 이 시즌에 배정된 멤버 ID 목록
  const { data: assigned } = await supabase
    .from("small_group_members")
    .select("member_id, small_groups!inner(season_id)")
    .eq("small_groups.season_id", seasonId);

  const assignedIds = (assigned || []).map((a) => a.member_id);

  // 재적/출석 멤버 중 미배정 멤버
  let query = supabase
    .from("members")
    .select("*")
    .in("status", ["active", "attending"])
    .order("name");

  if (assignedIds.length > 0) {
    // Supabase doesn't have "not in" with array directly, use filter
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).filter((m) => !assignedIds.includes(m.id));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function assignMember(groupId: number, memberId: number, seasonId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("small_group_members")
    .insert({ group_id: groupId, member_id: memberId });
  if (error) throw error;
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

export async function unassignMember(groupId: number, memberId: number, seasonId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("small_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("member_id", memberId);
  if (error) throw error;
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}
