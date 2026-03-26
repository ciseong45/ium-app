"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";
import type {
  WorshipPosition,
  WorshipAttendanceRecord,
  WorshipMemberWithPositions,
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
    // 삭제
    const { error } = await supabase
      .from("worship_member_positions")
      .delete()
      .eq("member_id", memberId)
      .eq("position_id", positionId);
    if (error) return { success: false, error: "포지션 해제에 실패했습니다." };
  } else {
    // 추가
    const { error } = await supabase
      .from("worship_member_positions")
      .insert({ member_id: memberId, position_id: positionId });
    if (error) return { success: false, error: "포지션 등록에 실패했습니다." };
  }

  revalidatePath("/worship/team");
  return { success: true };
}

// ── 출석 관리 ──

export async function getWorshipAttendance(
  weekDate: string
): Promise<WorshipAttendanceRecord[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("worship_attendance")
    .select("*")
    .eq("week_date", weekDate);
  if (error) return [];
  return data as WorshipAttendanceRecord[];
}

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

  revalidatePath("/worship/team");
  return { success: true };
}
