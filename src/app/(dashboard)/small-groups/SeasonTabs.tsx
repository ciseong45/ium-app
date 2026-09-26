"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRole } from "@/lib/RoleContext";
import type { Member } from "@/types/member";
import type { GroupMemberEntry, UpperRoom } from "@/types/small-group";
import type { Campaign, RegistrationApplication } from "@/lib/small-group-registration";
import SeasonDetail from "./[seasonId]/SeasonDetail";
import ApplicationsWorkspace from "./ApplicationsWorkspace";
import CampaignSettings from "./CampaignSettings";

type Season = { id: number; name: string; start_date?: string | null; end_date?: string | null; is_active: boolean; created_at?: string };
type Group = { id: number; name: string; season_id: number; upper_room_id: number; leader: { id: number; last_name: string; first_name: string } | null };

export default function SeasonTabs({ season, seasons, groups, upperRooms, unassignedMembers,
  initialGroupMembers, campaigns, selectedCampaignId, initialApplications, educationLabels, operatorSettings, hideHeader = false }: {
  season: Season; seasons?: Season[]; groups: Group[]; upperRooms: UpperRoom[];
  unassignedMembers: Member[]; initialGroupMembers: Record<number, GroupMemberEntry[]>;
  campaigns: Campaign[]; selectedCampaignId: number | null; initialApplications: RegistrationApplication[];
  educationLabels: Record<number, string>;
  operatorSettings: { choices: { id: string; name: string }[]; assigned: Record<number, string[]> };
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const role = useRole();
  const requested = params.get("tab");
  const canManageApplications = role === "admin" || role === "upper_room_leader";
  const tab = requested === "applications" && canManageApplications ? "applications"
    : requested === "campaigns" && role === "admin" ? "campaigns" : "roster";
  const base = `/small-groups/${season.id}`;

  return <div>
    <div role="tablist" aria-label="순 운영" className="mb-5 flex border-b border-[var(--color-warm-border)]">
      {([
        ["roster", "순별 명단"],
        ...(canManageApplications ? [["applications", "신청·배정"]] : []),
        ...(role === "admin" ? [["campaigns", "모집 설정"]] : []),
      ] as [string, string][]).map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key}
        onClick={() => router.push(`${base}?tab=${key}${key === "applications" && selectedCampaignId ? `&campaign=${selectedCampaignId}` : ""}`)}
        className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === key ? "border-[var(--color-warm-text)] text-[var(--color-warm-text)]" : "border-transparent text-[var(--color-warm-muted)]"}`}>
        {label}</button>)}
    </div>
    {tab === "roster" && <SeasonDetail season={season} seasons={seasons} groups={groups}
      upperRooms={upperRooms} unassignedMembers={unassignedMembers}
      initialGroupMembers={initialGroupMembers} hideHeader={hideHeader} />}
    {tab === "applications" && <ApplicationsWorkspace campaigns={campaigns} selectedCampaignId={selectedCampaignId}
      initialApplications={initialApplications} educationLabels={educationLabels}
      currentGroups={Object.fromEntries(Object.entries(initialGroupMembers).flatMap(([groupId, entries]) => entries.flatMap(entry => entry.kind === "application" ? [] : [[entry.member.id, Number(groupId)]])))}
      groupSizes={Object.fromEntries(Object.entries(initialGroupMembers).map(([groupId, entries]) => [Number(groupId), entries.length]))}
      groups={groups} seasonId={season.id} />}
    {tab === "campaigns" && <CampaignSettings campaigns={campaigns} seasonId={season.id} operatorSettings={operatorSettings} />}
  </div>;
}
