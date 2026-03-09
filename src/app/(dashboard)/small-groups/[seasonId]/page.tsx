import {
  getSeasons,
  getGroupsBySeason,
  getUnassignedMembers,
  getAllGroupMembersForSeason,
} from "../actions";
import SeasonDetail from "./SeasonDetail";
import type { Member } from "@/types/member";

type GroupMemberEntry = {
  id: number;
  group_id: number;
  member: Member;
};

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const { seasonId } = await params;
  const id = Number(seasonId);

  const [seasons, groups, unassigned, allGroupMembers] = await Promise.all([
    getSeasons(),
    getGroupsBySeason(id),
    getUnassignedMembers(id),
    getAllGroupMembersForSeason(id),
  ]);

  const season = seasons.find((s) => s.id === id);
  if (!season) {
    return <p className="text-gray-500">시즌을 찾을 수 없습니다.</p>;
  }

  // 그룹별 멤버 맵 구성
  const groupMembersMap: Record<number, GroupMemberEntry[]> = {};
  for (const group of groups) {
    groupMembersMap[group.id] = (allGroupMembers as GroupMemberEntry[]).filter(
      (m) => m.group_id === group.id
    );
  }

  return (
    <SeasonDetail
      season={season}
      groups={groups}
      unassignedMembers={unassigned}
      initialGroupMembers={groupMembersMap}
    />
  );
}
