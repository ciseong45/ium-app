import {
  getActiveMembers,
  getAttendanceByWeek,
  getRecentAttendance,
  getAttendanceDates,
} from "./actions";
import AttendanceView from "./AttendanceView";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tab?: string }>;
}) {
  const params = await searchParams;

  // 기본 날짜: 가장 최근 일요일
  const today = new Date();
  const dayOfWeek = today.getDay();
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek);
  const defaultDate = lastSunday.toISOString().split("T")[0];
  const selectedDate = params.date || defaultDate;

  const [members, attendance, recent, dates] = await Promise.all([
    getActiveMembers(),
    getAttendanceByWeek(selectedDate),
    getRecentAttendance(8),
    getAttendanceDates(),
  ]);

  return (
    <AttendanceView
      members={members}
      attendance={attendance}
      recentData={recent}
      attendanceDates={dates}
      selectedDate={selectedDate}
      currentTab={params.tab || "check"}
    />
  );
}
