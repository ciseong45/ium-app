import {
  getPositions,
  getWorshipMembers,
  getNonWorshipMembers,
  getMemberPositions,
  getRecentWorshipAttendance,
  getMemberSchedules,
} from "./actions";
import WorshipMembersView from "./WorshipMembersView";

export default async function WorshipMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;

  const [positions, members, nonMembers, memberPositions, recentAttendance, schedules] =
    await Promise.all([
      getPositions(),
      getWorshipMembers(),
      getNonWorshipMembers(),
      getMemberPositions(),
      getRecentWorshipAttendance(8),
      getMemberSchedules(),
    ]);

  return (
    <WorshipMembersView
      positions={positions}
      members={members}
      nonMembers={nonMembers}
      memberPositions={memberPositions}
      recentAttendance={recentAttendance}
      schedules={schedules}
      currentTab={params.tab || "members"}
    />
  );
}
