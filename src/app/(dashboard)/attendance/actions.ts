"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";
import { getActiveSeason } from "@/lib/queries";
import type { AttendanceStatus, AttendanceRecord } from "@/types/attendance";

// ===== 순 목록 (내 권한에 맞는) =====

export type GroupOption = {
  id: number;
  name: string;
  upper_room_name: string;
  leader_name: string | null;
};

export async function getMyGroups(): Promise<GroupOption[]> {
  const { supabase, role, linkedMemberId } = await requireAuth();
  const activeSeason = await getActiveSeason(supabase);
  if (!activeSeason) return [];

  const selectFields =
    "id, name, upper_room:upper_rooms!upper_room_id(name), leader:members!leader_id(last_name, first_name)";

  let data: any[] | null = null;

  if (role === "admin") {
    const res = await supabase
      .from("small_groups")
      .select(selectFields)
      .eq("season_id", activeSeason.id)
      .order("name");
    data = res.data;
  } else if (role === "upper_room_leader" && linkedMemberId) {
    // 내 다락방의 그룹들
    const { data: myUpperRooms } = await supabase
      .from("upper_rooms")
      .select("id")
      .eq("leader_id", linkedMemberId)
      .eq("season_id", activeSeason.id);
    const urIds = (myUpperRooms ?? []).map((ur: { id: number }) => ur.id);
    if (urIds.length === 0) return [];
    const res = await supabase
      .from("small_groups")
      .select(selectFields)
      .in("upper_room_id", urIds)
      .order("name");
    data = res.data;
  } else if (role === "group_leader" && linkedMemberId) {
    const res = await supabase
      .from("small_groups")
      .select(selectFields)
      .eq("leader_id", linkedMemberId)
      .eq("season_id", activeSeason.id);
    data = res.data;
  }

  if (!data) return [];
  return data.map((g: any) => ({
    id: g.id as number,
    name: g.name as string,
    upper_room_name: (g.upper_room as any)?.name ?? "",
    leader_name: (g.leader as any) ? `${(g.leader as any).last_name}${(g.leader as any).first_name}` : null,
  }));
}

// ===== 순의 멤버 목록 =====

export async function getGroupMembersForAttendance(groupId: number) {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("small_group_members")
    .select("member:members!member_id(id, last_name, first_name)")
    .eq("group_id", groupId)
    .order("created_at");
  if (error || !data) return [];
  return (data as any[]).map((d) => ({
    id: d.member.id as number,
    name: `${d.member.last_name}${d.member.first_name}` as string,
  }));
}

// ===== 순별 출석 데이터 조회 =====

export async function getGroupAttendance(
  groupId: number,
  weekDate: string
): Promise<AttendanceRecord[]> {
  const { supabase } = await requireAuth();

  // 해당 순의 멤버 ID 목록
  const { data: sgMembers } = await supabase
    .from("small_group_members")
    .select("member_id")
    .eq("group_id", groupId);
  const memberIds = (sgMembers ?? []).map((m: { member_id: number }) => m.member_id);
  if (memberIds.length === 0) return [];

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .in("member_id", memberIds)
    .eq("week_date", weekDate);

  if (error) return [];
  return (data ?? []) as AttendanceRecord[];
}

// ===== 순별 출석 저장 =====

export async function saveGroupAttendance(
  groupId: number,
  weekDate: string,
  records: {
    member_id: number;
    status: AttendanceStatus;
    prayer_request: boolean;
    prayer_note: string | null;
  }[]
): Promise<ActionResult> {
  const { supabase, user, role, linkedMemberId } = await requireAuth();

  // 권한 체크: 해당 순에 대한 접근 권한 확인
  if (role !== "admin") {
    const activeSeason = await getActiveSeason(supabase);
    if (!activeSeason || !linkedMemberId) {
      return { success: false, error: "멤버 연결이 필요합니다. 관리자에게 문의하세요." };
    }

    if (role === "group_leader") {
      // 순장: 자기 순만 가능
      const { data: group } = await supabase
        .from("small_groups")
        .select("leader_id")
        .eq("id", groupId)
        .single();
      if (!group || group.leader_id !== linkedMemberId) {
        return { success: false, error: "자신의 순만 출석을 기록할 수 있습니다." };
      }
    } else if (role === "upper_room_leader") {
      // 다락방장: 자기 다락방의 순만 가능
      const { data: group } = await supabase
        .from("small_groups")
        .select("upper_room_id, upper_rooms!upper_room_id(leader_id)")
        .eq("id", groupId)
        .single();
      const urLeaderId = (group as any)?.upper_rooms?.leader_id;
      if (urLeaderId !== linkedMemberId) {
        return { success: false, error: "자신의 다락방 순만 출석을 기록할 수 있습니다." };
      }
    }
  }

  if (!weekDate || records.length === 0) {
    return { success: false, error: "저장할 출석 데이터가 없습니다." };
  }

  const rows = records.map((r) => ({
    member_id: r.member_id,
    week_date: weekDate,
    status: r.status,
    prayer_request: r.prayer_request,
    prayer_note: r.prayer_note || null,
    checked_by: user.id,
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "member_id,week_date" });

  if (error) return { success: false, error: "출석 저장에 실패했습니다." };
  revalidatePath("/attendance");
  return { success: true };
}

// ===== 순별 최근 출석 현황 =====

export async function getGroupRecentAttendance(groupId: number, weeks: number = 8) {
  const { supabase } = await requireAuth();

  // 해당 순의 멤버 ID 목록
  const { data: sgMembers } = await supabase
    .from("small_group_members")
    .select("member_id")
    .eq("group_id", groupId);
  const memberIds = (sgMembers ?? []).map((m: { member_id: number }) => m.member_id);
  if (memberIds.length === 0) return { records: [] as AttendanceRecord[], dates: [] as string[] };

  // 최근 N주 날짜 목록
  const dates: string[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek);

  for (let i = 0; i < weeks; i++) {
    const d = new Date(lastSunday);
    d.setDate(lastSunday.getDate() - i * 7);
    dates.push(d.toISOString().split("T")[0]);
  }

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .in("member_id", memberIds)
    .in("week_date", dates)
    .order("week_date", { ascending: false });

  if (error) return { records: [] as AttendanceRecord[], dates };
  return { records: (data ?? []) as AttendanceRecord[], dates };
}
