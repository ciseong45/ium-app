import {
  getMyGroups,
  getGroupMembersForAttendance,
  getGroupAttendance,
  getGroupRecentAttendance,
} from "./actions";
import AttendanceView from "./AttendanceView";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; date?: string; tab?: string }>;
}) {
  const params = await searchParams;

  // 기본 날짜: 가장 최근 일요일
  const today = new Date();
  const dayOfWeek = today.getDay();
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek);
  const defaultDate = lastSunday.toISOString().split("T")[0];
  const selectedDate = params.date || defaultDate;

  // 접근 가능한 순 목록
  const groups = await getMyGroups();

  // 순 자동 선택: 순이 1개면 자동 선택
  const selectedGroupId = params.group
    ? Number(params.group)
    : groups.length === 1
      ? groups[0].id
      : null;

  // 선택된 순이 있으면 데이터 fetch
  let members: { id: number; name: string }[] = [];
  let attendance: Awaited<ReturnType<typeof getGroupAttendance>> = [];
  let recentData: Awaited<ReturnType<typeof getGroupRecentAttendance>> = {
    records: [],
    dates: [],
  };

  if (selectedGroupId) {
    [members, attendance, recentData] = await Promise.all([
      getGroupMembersForAttendance(selectedGroupId),
      getGroupAttendance(selectedGroupId, selectedDate),
      getGroupRecentAttendance(selectedGroupId, 8),
    ]);
  }

  return (
    <AttendanceView
      groups={groups}
      selectedGroupId={selectedGroupId}
      members={members}
      attendance={attendance}
      recentData={recentData}
      selectedDate={selectedDate}
      currentTab={params.tab || "check"}
    />
  );
}
