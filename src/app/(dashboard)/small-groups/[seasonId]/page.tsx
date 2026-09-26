import {
  getSeasons,
  getGroupsBySeason,
  getUnassignedMembers,
  getAllGroupMembersForSeason,
  getUpperRoomsBySeason,
} from "../actions";
import { getApplicationsByCampaign, getCampaignsBySeason, getEducationLabels, getOperatorSettings } from "../registration-actions";
import SeasonTabs from "../SeasonTabs";
import type { Member } from "@/types/member";
import type { GroupMemberEntry } from "@/types/small-group";

export default async function SeasonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ seasonId: string }>;
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { seasonId } = await params;
  const query = await searchParams;
  const id = Number(seasonId);

  const [seasons, groups, unassigned, allGroupMembers, upperRooms, campaigns] = await Promise.all([
    getSeasons(),
    getGroupsBySeason(id),
    getUnassignedMembers(id),
    getAllGroupMembersForSeason(id),
    getUpperRoomsBySeason(id),
    getCampaignsBySeason(id),
  ]);
  const selectedCampaignId = campaigns.find(c => c.id === Number(query.campaign))?.id ?? campaigns[0]?.id ?? null;
  const initialApplications = selectedCampaignId ? await getApplicationsByCampaign(selectedCampaignId) : [];
  const educationLabels = selectedCampaignId ? await getEducationLabels(selectedCampaignId, initialApplications) : {};
  const operatorSettings = await getOperatorSettings(id);

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

  return (
    <SeasonTabs
      season={season}
      seasons={seasons}
      groups={groups}
      upperRooms={upperRooms}
      unassignedMembers={unassigned as Member[]}
      initialGroupMembers={groupMembersMap}
      campaigns={campaigns}
      selectedCampaignId={selectedCampaignId}
      initialApplications={initialApplications}
      educationLabels={educationLabels}
      operatorSettings={operatorSettings}
    />
  );
}
