"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";

// ===== 시즌 =====

export async function getSeasons() {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("small_group_seasons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data;
}

export async function getActiveSeason() {
  const { supabase } = await requireAuth();
  const { data } = await supabase
    .from("small_group_seasons")
    .select("*")
    .eq("is_active", true)
    .single();
  return data;
}

export async function createSeason(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { success: false, error: "시즌 이름은 필수입니다." };

  const { data: newSeason, error } = await supabase
    .from("small_group_seasons")
    .insert({
      name,
      start_date: (formData.get("start_date") as string) || null,
      end_date: (formData.get("end_date") as string) || null,
      is_active: formData.get("is_active") === "on",
    })
    .select("id")
    .single();
  if (error || !newSeason) return { success: false, error: "시즌 생성에 실패했습니다." };

  // 3개 다락방 자동 생성
  await supabase.from("upper_rooms").insert([
    { season_id: newSeason.id, name: "1다락방", display_order: 1 },
    { season_id: newSeason.id, name: "2다락방", display_order: 2 },
    { season_id: newSeason.id, name: "3다락방", display_order: 3 },
  ]);

  revalidatePath("/small-groups");
  return { success: true };
}

export async function updateSeason(id: number, formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { success: false, error: "시즌 이름은 필수입니다." };

  const { error } = await supabase
    .from("small_group_seasons")
    .update({
      name,
      start_date: (formData.get("start_date") as string) || null,
      end_date: (formData.get("end_date") as string) || null,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);
  if (error) return { success: false, error: "시즌 수정에 실패했습니다." };
  revalidatePath("/small-groups");
  return { success: true };
}

export async function deleteSeason(id: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase
    .from("small_group_seasons")
    .delete()
    .eq("id", id);
  if (error) return { success: false, error: "시즌 삭제에 실패했습니다." };
  revalidatePath("/small-groups");
  return { success: true };
}

// ===== 다락방 =====

export async function getUpperRoomsBySeason(seasonId: number) {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("upper_rooms")
    .select("*, leader:members!leader_id(id, last_name, first_name)")
    .eq("season_id", seasonId)
    .order("display_order");
  if (error) return [];
  return (data ?? []).map((d: any) => ({
    id: d.id as number,
    season_id: d.season_id as number,
    name: d.name as string,
    leader_id: d.leader_id as number | null,
    leader: d.leader as { id: number; last_name: string; first_name: string } | null,
    display_order: d.display_order as number,
  }));
}

export async function updateUpperRoom(
  id: number,
  seasonId: number,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { success: false, error: "다락방 이름은 필수입니다." };

  const leaderId = formData.get("leader_id") as string;
  const { error } = await supabase
    .from("upper_rooms")
    .update({
      name,
      leader_id: leaderId ? Number(leaderId) : null,
    })
    .eq("id", id);
  if (error) return { success: false, error: "다락방 수정에 실패했습니다." };
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

// ===== 순 =====

export async function getGroupsBySeason(seasonId: number) {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("small_groups")
    .select("*, leader:members!leader_id(id, last_name, first_name)")
    .eq("season_id", seasonId)
    .order("name");
  if (error) return [];
  return data;
}

export async function createGroup(
  seasonId: number,
  upperRoomId: number,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { success: false, error: "그룹 이름은 필수입니다." };

  const leaderId = formData.get("leader_id") as string;
  const { error } = await supabase.from("small_groups").insert({
    season_id: seasonId,
    upper_room_id: upperRoomId,
    name,
    leader_id: leaderId ? Number(leaderId) : null,
  });
  if (error) return { success: false, error: "그룹 생성에 실패했습니다." };
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

export async function updateGroup(groupId: number, seasonId: number, formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { success: false, error: "그룹 이름은 필수입니다." };

  const leaderId = formData.get("leader_id") as string;
  const { error } = await supabase
    .from("small_groups")
    .update({
      name,
      leader_id: leaderId ? Number(leaderId) : null,
    })
    .eq("id", groupId);
  if (error) return { success: false, error: "그룹 수정에 실패했습니다." };
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

export async function deleteGroup(groupId: number, seasonId: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase
    .from("small_groups")
    .delete()
    .eq("id", groupId);
  if (error) return { success: false, error: "그룹 삭제에 실패했습니다." };
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

export async function moveGroupToUpperRoom(
  groupId: number,
  upperRoomId: number,
  seasonId: number
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase
    .from("small_groups")
    .update({ upper_room_id: upperRoomId })
    .eq("id", groupId);
  if (error) return { success: false, error: "순 이동에 실패했습니다." };
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

// ===== 멤버 배정 =====

export async function getGroupMembers(groupId: number) {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("small_group_members")
    .select("*, member:members(*)")
    .eq("group_id", groupId)
    .order("created_at");
  if (error) return [];
  return data;
}

// 시즌 내 모든 그룹의 멤버를 한 번에 조회 (N+1 쿼리 방지)
export async function getAllGroupMembersForSeason(seasonId: number) {
  const { supabase } = await requireAuth();

  const { data: groups } = await supabase
    .from("small_groups")
    .select("id")
    .eq("season_id", seasonId);

  if (!groups || groups.length === 0) return [];

  const groupIds = groups.map((g: { id: number }) => g.id);
  const { data, error } = await supabase
    .from("small_group_members")
    .select("id, group_id, member:members(*)")
    .in("group_id", groupIds)
    .order("created_at");

  if (error) return [];
  return (data ?? []).map((d: any) => ({
    id: d.id as number,
    group_id: d.group_id as number,
    member: d.member as import("@/types/member").Member,
  }));
}

export async function getUnassignedMembers(seasonId: number) {
  const { supabase } = await requireAuth();

  // 이 시즌에 배정된 멤버 ID 목록
  const { data: assigned } = await supabase
    .from("small_group_members")
    .select("member_id, small_groups!inner(season_id)")
    .eq("small_groups.season_id", seasonId);

  const assignedIds = (assigned || []).map((a) => a.member_id);

  // 재적/출석 멤버 중 미배정 멤버 — DB 레벨에서 필터링
  let query = supabase
    .from("members")
    .select("*")
    .in("status", ["active", "attending"])
    .order("last_name")
    .order("first_name");

  if (assignedIds.length > 0) {
    query = query.not("id", "in", `(${assignedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) return [];
  return data;
}

export async function assignMember(groupId: number, memberId: number, seasonId: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase
    .from("small_group_members")
    .insert({ group_id: groupId, member_id: memberId });
  if (error) return { success: false, error: "멤버 배정에 실패했습니다." };
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

export async function unassignMember(groupId: number, memberId: number, seasonId: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase
    .from("small_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("member_id", memberId);
  if (error) return { success: false, error: "멤버 제외에 실패했습니다." };
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}
