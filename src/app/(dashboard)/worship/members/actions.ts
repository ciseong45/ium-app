"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";
import type {
  WorshipPosition,
  WorshipAttendanceRecord,
  WorshipMemberSchedule,
} from "@/types/worship";
import type { Member } from "@/types/member";

// ── 포지션 목록 ──

export async function getPositions(): Promise<WorshipPosition[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("worship_positions")
    .select("*")
    .order("display_order");
  if (error) return [];
  return data as WorshipPosition[];
}

// ── 찬양팀 멤버 목록 (member_ministry_teams 기반) ──

export async function getWorshipMembers(): Promise<Member[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("member_ministry_teams")
    .select("member_id, members!inner(id, last_name, first_name, status)")
    .eq("ministry_team_id", 1); // 찬양팀 = id 1

  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .map((row) => row.members as Member)
    .filter((m) => m.status !== "removed" && m.status !== "inactive")
    .sort((a, b) =>
      `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`)
    );
}

// ── 예배팀에 속하지 않은 멤버 목록 (추가용) ──

export async function getNonWorshipMembers(): Promise<Member[]> {
  const { supabase } = await requireAuth();

  // 현재 예배팀 멤버 ID 목록
  const { data: worshipData } = await supabase
    .from("member_ministry_teams")
    .select("member_id")
    .eq("ministry_team_id", 1);

  const worshipMemberIds = (worshipData || []).map((d) => d.member_id);

  // 전체 활성 멤버에서 예배팀 멤버 제외
  let query = supabase
    .from("members")
    .select("id, last_name, first_name, status")
    .not("status", "in", '("removed","inactive")')
    .order("last_name")
    .order("first_name");

  if (worshipMemberIds.length > 0) {
    query = query.not("id", "in", `(${worshipMemberIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Member[];
}

// ── 멤버 추가/제거 ──

export async function addWorshipMember(memberId: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase
    .from("member_ministry_teams")
    .insert({ member_id: memberId, ministry_team_id: 1 });

  if (error) return { success: false, error: "멤버 추가에 실패했습니다." };

  revalidatePath("/worship/members");
  return { success: true };
}

export async function removeWorshipMember(memberId: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  // 멤버를 예배팀에서 제거
  const { error } = await supabase
    .from("member_ministry_teams")
    .delete()
    .eq("member_id", memberId)
    .eq("ministry_team_id", 1);

  if (error) return { success: false, error: "멤버 제거에 실패했습니다." };

  // 포지션 매핑도 함께 제거
  await supabase
    .from("worship_member_positions")
    .delete()
    .eq("member_id", memberId);

  revalidatePath("/worship/members");
  return { success: true };
}

// ── 멤버 포지션 매트릭스 ──

export async function getMemberPositions(): Promise<
  { member_id: number; position_id: number; is_capable: boolean }[]
> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("worship_member_positions")
    .select("member_id, position_id, is_capable");
  if (error) return [];
  return data;
}

export async function toggleMemberPosition(
  memberId: number,
  positionId: number,
  isCurrent: boolean
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  if (isCurrent) {
    const { error } = await supabase
      .from("worship_member_positions")
      .delete()
      .eq("member_id", memberId)
      .eq("position_id", positionId);
    if (error) return { success: false, error: "포지션 해제에 실패했습니다." };
  } else {
    const { error } = await supabase
      .from("worship_member_positions")
      .insert({ member_id: memberId, position_id: positionId });
    if (error) return { success: false, error: "포지션 등록에 실패했습니다." };
  }

  revalidatePath("/worship/members");
  return { success: true };
}

// ── 출석 관리 ──

export async function getRecentWorshipAttendance(
  weeks: number = 8
): Promise<{ records: WorshipAttendanceRecord[]; dates: string[] }> {
  const { supabase } = await requireAuth();
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - weeks * 7);

  const { data, error } = await supabase
    .from("worship_attendance")
    .select("*")
    .gte("week_date", startDate.toISOString().split("T")[0])
    .order("week_date", { ascending: false });

  if (error || !data) return { records: [], dates: [] };

  const dates = [...new Set(data.map((r: WorshipAttendanceRecord) => r.week_date))].sort(
    (a, b) => b.localeCompare(a)
  );
  return { records: data as WorshipAttendanceRecord[], dates };
}

export async function upsertWorshipAttendance(
  memberId: number,
  weekDate: string,
  isPresent: boolean,
  absenceReason: string | null
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase.from("worship_attendance").upsert(
    {
      member_id: memberId,
      week_date: weekDate,
      is_present: isPresent,
      absence_reason: isPresent ? null : absenceReason,
    },
    { onConflict: "member_id,week_date" }
  );

  if (error)
    return { success: false, error: "출석 기록에 실패했습니다." };

  revalidatePath("/worship/members");
  return { success: true };
}

// ── 스케줄 (Off/OOT) 관리 ──

export async function getMemberSchedules(
  startDate?: string,
  endDate?: string
): Promise<WorshipMemberSchedule[]> {
  const { supabase } = await requireAuth();

  let query = supabase
    .from("worship_member_schedules")
    .select("*")
    .order("start_date", { ascending: true });

  if (startDate) {
    query = query.gte("end_date", startDate);
  }
  if (endDate) {
    query = query.lte("start_date", endDate);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as WorshipMemberSchedule[];
}

export async function addMemberSchedule(
  memberId: number,
  startDate: string,
  endDate: string,
  type: string,
  note: string | null
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase.from("worship_member_schedules").insert({
    member_id: memberId,
    start_date: startDate,
    end_date: endDate,
    type,
    note,
  });

  if (error) return { success: false, error: "스케줄 등록에 실패했습니다." };

  revalidatePath("/worship/members");
  return { success: true };
}

export async function deleteMemberSchedule(scheduleId: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase
    .from("worship_member_schedules")
    .delete()
    .eq("id", scheduleId);

  if (error) return { success: false, error: "스케줄 삭제에 실패했습니다." };

  revalidatePath("/worship/members");
  return { success: true };
}
