import {
  getSeasons,
  getGroupsBySeason,
  getUnassignedMembers,
  getAllGroupMembersForSeason,
  getUpperRoomsBySeason,
} from "./actions";
import { getApplicationsByCampaign, getCampaignsBySeason, getEducationLabels, getOperatorSettings } from "./registration-actions";
import SmallGroupsView from "./SmallGroupsView";
import type { GroupMemberEntry } from "@/types/small-group";

export default async function SmallGroupsPage({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const query = await searchParams;
  const seasons = await getSeasons();
  const activeSeason = seasons.find((s) => s.is_active) ?? null;

  // 활성 시즌이 있으면 해당 시즌의 모든 데이터 병렬 로드
  if (activeSeason) {
    const [groups, unassigned, allGroupMembers, upperRooms, campaigns] = await Promise.all([
      getGroupsBySeason(activeSeason.id),
      getUnassignedMembers(activeSeason.id),
      getAllGroupMembersForSeason(activeSeason.id),
      getUpperRoomsBySeason(activeSeason.id),
      getCampaignsBySeason(activeSeason.id),
    ]);
    const selectedCampaignId = campaigns.find(c => c.id === Number(query.campaign))?.id ?? campaigns[0]?.id ?? null;
    const initialApplications = selectedCampaignId ? await getApplicationsByCampaign(selectedCampaignId) : [];
    const educationLabels = selectedCampaignId ? await getEducationLabels(selectedCampaignId, initialApplications) : {};
    const operatorSettings = await getOperatorSettings(activeSeason.id);

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
        campaigns={campaigns}
        selectedCampaignId={selectedCampaignId}
        initialApplications={initialApplications}
        educationLabels={educationLabels}
        operatorSettings={operatorSettings}
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
      campaigns={[]}
      selectedCampaignId={null}
      initialApplications={[]}
      educationLabels={{}}
      operatorSettings={{ choices: [], assigned: {} }}
    />
  );
}
