"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AttendanceStatus = "present" | "absent" | "online";

export type AttendanceRecord = {
  id: number;
  member_id: number;
  week_date: string;
  status: AttendanceStatus;
};

// 특정 주의 출석 데이터 가져오기
export async function getAttendanceByWeek(weekDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("week_date", weekDate);
  if (error) throw error;
  return data as AttendanceRecord[];
}

// 활동 멤버 목록 (재적 + 출석)
export async function getActiveMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, name, status")
    .in("status", ["active", "attending"])
    .order("name");
  if (error) throw error;
  return data;
}

// 출석 일괄 저장 (upsert)
export async function saveAttendance(
  weekDate: string,
  records: { member_id: number; status: AttendanceStatus }[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = records.map((r) => ({
    member_id: r.member_id,
    week_date: weekDate,
    status: r.status,
    checked_by: user?.id,
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "member_id,week_date" });

  if (error) throw error;
  revalidatePath("/attendance");
  return { success: true };
}

// 최근 N주 출석 기록 가져오기 (통계용)
export async function getRecentAttendance(weeks: number = 8) {
  const supabase = await createClient();

  // 최근 N주 날짜 목록
  const dates: string[] = [];
  const today = new Date();
  // 가장 최근 일요일 찾기
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

  if (error) throw error;
  return { records: data as AttendanceRecord[], dates };
}

// 출석 기록이 있는 날짜 목록
export async function getAttendanceDates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("week_date")
    .order("week_date", { ascending: false });
  if (error) throw error;

  // 중복 제거
  const uniqueDates = [...new Set((data || []).map((d) => d.week_date))];
  return uniqueDates;
}
