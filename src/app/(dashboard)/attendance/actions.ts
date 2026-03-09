"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";

export type AttendanceStatus = "present" | "absent" | "online";

export type AttendanceRecord = {
  id: number;
  member_id: number;
  week_date: string;
  status: AttendanceStatus;
};

// 특정 주의 출석 데이터 가져오기
export async function getAttendanceByWeek(weekDate: string) {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("week_date", weekDate);
  if (error) return [] as AttendanceRecord[];
  return data as AttendanceRecord[];
}

// 활동 멤버 목록 (재적 + 출석)
export async function getActiveMembers() {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("members")
    .select("id, name, status")
    .in("status", ["active", "attending"])
    .order("name");
  if (error) return [];
  return data;
}

// 출석 일괄 저장 (upsert)
export async function saveAttendance(
  weekDate: string,
  records: { member_id: number; status: AttendanceStatus }[]
): Promise<ActionResult> {
  const { supabase, user, role } = await requireAuth();
  if (role === "viewer") return { success: false, error: "권한이 없습니다." };

  if (!weekDate || records.length === 0) {
    return { success: false, error: "저장할 출석 데이터가 없습니다." };
  }

  const rows = records.map((r) => ({
    member_id: r.member_id,
    week_date: weekDate,
    status: r.status,
    checked_by: user.id,
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "member_id,week_date" });

  if (error) return { success: false, error: "출석 저장에 실패했습니다." };
  revalidatePath("/attendance");
  return { success: true };
}

// 최근 N주 출석 기록 가져오기 (통계용)
export async function getRecentAttendance(weeks: number = 8) {
  const { supabase } = await requireAuth();

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
    .in("week_date", dates)
    .order("week_date", { ascending: false });

  if (error) return { records: [] as AttendanceRecord[], dates };
  return { records: data as AttendanceRecord[], dates };
}

// 출석 기록이 있는 날짜 목록
export async function getAttendanceDates() {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("attendance")
    .select("week_date")
    .order("week_date", { ascending: false });
  if (error) return [];

  const uniqueDates = [...new Set((data || []).map((d) => d.week_date))];
  return uniqueDates;
}
