import {
  getSeasons,
  getGroupsBySeason,
  getUnassignedMembers,
  getAllGroupMembersForSeason,
  getUpperRoomsBySeason,
} from "../actions";
import { getPool } from "../applications-actions";
import SeasonDetail from "./SeasonDetail";
import PoolSection from "./PoolSection";
import type { Member } from "@/types/member";
import type { GroupMemberEntry } from "@/types/small-group";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const { seasonId } = await params;
  const id = Number(seasonId);

  const [seasons, groups, unassigned, allGroupMembers, upperRooms, pool] = await Promise.all([
    getSeasons(),
    getGroupsBySeason(id),
    getUnassignedMembers(id),
    getAllGroupMembersForSeason(id),
    getUpperRoomsBySeason(id),
    getPool(id),
  ]);

  const season = seasons.find((s) => s.id === id);
  if (!season) {
    return <p className="text-gray-500">시즌을 찾을 수 없습니다.</p>;
  }

  const groupMembersMap: Record<number, GroupMemberEntry[]> = {};
  for (const group of groups) {
    groupMembersMap[group.id] = (allGroupMembers as GroupMemberEntry[]).filter(
      (m) => m.group_id === group.id
    );
  }

  const groupList = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <>
      <SeasonDetail
        season={season}
        seasons={seasons}
        groups={groups}
        upperRooms={upperRooms}
        unassignedMembers={unassigned as Member[]}
        initialGroupMembers={groupMembersMap}
      />
      <PoolSection seasonId={id} initialPool={pool} groups={groupList} />
    </>
  );
}
