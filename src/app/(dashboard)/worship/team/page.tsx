import {
  getPositions,
  getWorshipMembers,
  getMemberPositions,
  getRecentWorshipAttendance,
} from "./actions";
import WorshipTeamView from "./WorshipTeamView";

export default async function WorshipTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;

  const [positions, members, memberPositions, recentAttendance] =
    await Promise.all([
      getPositions(),
      getWorshipMembers(),
      getMemberPositions(),
      getRecentWorshipAttendance(8),
    ]);

  return (
    <WorshipTeamView
      positions={positions}
      members={members}
      memberPositions={memberPositions}
      recentAttendance={recentAttendance}
      currentTab={params.tab || "positions"}
    />
  );
}
