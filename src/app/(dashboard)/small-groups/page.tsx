import {
  getSeasons,
  getGroupsBySeason,
  getUnassignedMembers,
  getAllGroupMembersForSeason,
  getUpperRoomsBySeason,
} from "./actions";
import SmallGroupsView from "./SmallGroupsView";
import type { GroupMemberEntry } from "@/types/small-group";

export default async function SmallGroupsPage() {
  const seasons = await getSeasons();
  const activeSeason = seasons.find((s) => s.is_active) ?? null;

  // 활성 시즌이 있으면 해당 시즌의 모든 데이터 병렬 로드
  if (activeSeason) {
    const [groups, unassigned, allGroupMembers, upperRooms] = await Promise.all([
      getGroupsBySeason(activeSeason.id),
      getUnassignedMembers(activeSeason.id),
      getAllGroupMembersForSeason(activeSeason.id),
      getUpperRoomsBySeason(activeSeason.id),
    ]);

    const groupMembersMap: Record<number, GroupMemberEntry[]> = {};
    for (const group of groups) {
      groupMembersMap[group.id] = (allGroupMembers as GroupMemberEntry[]).filter(
        (m) => m.group_id === group.id
      );
    }

    return (
      <SmallGroupsView
        seasons={seasons}
        activeSeason={activeSeason}
        groups={groups}
        upperRooms={upperRooms}
        unassignedMembers={unassigned}
        initialGroupMembers={groupMembersMap}
      />
    );
  }

  return (
    <SmallGroupsView
      seasons={seasons}
      activeSeason={null}
      groups={[]}
      upperRooms={[]}
      unassignedMembers={[]}
      initialGroupMembers={{}}
    />
  );
}
