import { getLineup, getRecentLineups } from "./actions";
import { getPositions, getWorshipMembers, getMemberPositions } from "../team/actions";
import LineupView from "./LineupView";

export default async function LineupPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;

  // 기본 날짜: 다음 일요일
  const today = new Date();
  const dayOfWeek = today.getDay();
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + (7 - dayOfWeek));
  const defaultDate = nextSunday.toISOString().split("T")[0];
  const selectedDate = params.date || defaultDate;

  const [positions, members, memberPositions, lineupData, recentLineups] =
    await Promise.all([
      getPositions(),
      getWorshipMembers(),
      getMemberPositions(),
      getLineup(selectedDate),
      getRecentLineups(12),
    ]);

  return (
    <LineupView
      positions={positions}
      members={members}
      memberPositions={memberPositions}
      lineup={lineupData.lineup}
      slots={lineupData.slots}
      recentLineups={recentLineups}
      selectedDate={selectedDate}
    />
  );
}
