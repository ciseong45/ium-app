"use client";

import { useMemo, useState } from "react";
import type { Member } from "@/types/member";
import type { GroupMemberEntry, UpperRoom } from "@/types/small-group";
import type { Application } from "./applications-actions";
import SeasonDetail from "./[seasonId]/SeasonDetail";
import PoolSection from "./[seasonId]/PoolSection";

type Season = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  created_at?: string;
};

type Group = {
  id: number;
  name: string;
  season_id: number;
  upper_room_id: number;
  leader: { id: number; last_name: string; first_name: string } | null;
};

type TabKey = "regular" | "summer";

function splitGroupMembers(initialGroupMembers: Record<number, GroupMemberEntry[]>) {
  const regular: Record<number, GroupMemberEntry[]> = {};
  const summer: Record<number, GroupMemberEntry[]> = {};

  for (const [groupId, members] of Object.entries(initialGroupMembers)) {
    regular[Number(groupId)] = members.filter((member) => member.kind !== "application");
    summer[Number(groupId)] = members.filter((member) => member.kind === "application");
  }

  return { regular, summer };
}

function buildDetailKey({
  prefix,
  seasonId,
  unassignedMembers,
  groupMembers,
}: {
  prefix: TabKey;
  seasonId: number;
  unassignedMembers: Member[];
  groupMembers: Record<number, GroupMemberEntry[]>;
}) {
  return [
    prefix,
    seasonId,
    unassignedMembers.map((member) => member.id).join(","),
    Object.entries(groupMembers)
      .map(([groupId, members]) =>
        `${groupId}:${members.map((member) => `${member.kind ?? "member"}-${member.id}`).join(",")}`
      )
      .join("|"),
  ].join("/");
}

export default function SeasonTabs({
  season,
  seasons,
  groups,
  upperRooms,
  unassignedMembers,
  initialGroupMembers,
  initialPool,
  hideHeader = false,
}: {
  season: Season;
  seasons?: Season[];
  groups: Group[];
  upperRooms: UpperRoom[];
  unassignedMembers: Member[];
  initialGroupMembers: Record<number, GroupMemberEntry[]>;
  initialPool: Application[];
  hideHeader?: boolean;
}) {
  const { regular, summer } = useMemo(
    () => splitGroupMembers(initialGroupMembers),
    [initialGroupMembers]
  );
  const hasSummerActivity =
    initialPool.length > 0 ||
    Object.values(summer).some((members) => members.length > 0);
  const [activeTab, setActiveTab] = useState<TabKey>(
    hasSummerActivity ? "summer" : "regular"
  );

  const regularKey = buildDetailKey({
    prefix: "regular",
    seasonId: season.id,
    unassignedMembers,
    groupMembers: regular,
  });
  const summerKey = buildDetailKey({
    prefix: "summer",
    seasonId: season.id,
    unassignedMembers: [],
    groupMembers: summer,
  });

  return (
    <div>
      <div className="mb-5 flex border-b border-[var(--color-warm-border)]">
        {[
          { key: "regular" as const, label: "정규순" },
          { key: "summer" as const, label: "여름순" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-[var(--color-warm-text)] text-[var(--color-warm-text)]"
                : "border-transparent text-[var(--color-warm-muted)] hover:text-[var(--color-warm-text)]"
            }`}
            aria-pressed={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "regular" ? (
        <SeasonDetail
          key={regularKey}
          season={season}
          seasons={seasons}
          groups={groups}
          upperRooms={upperRooms}
          unassignedMembers={unassignedMembers}
          initialGroupMembers={regular}
          hideHeader={hideHeader}
        />
      ) : (
        <>
          <SeasonDetail
            key={summerKey}
            season={season}
            seasons={seasons}
            groups={groups}
            upperRooms={upperRooms}
            unassignedMembers={[]}
            initialGroupMembers={summer}
            hideHeader={hideHeader}
            enableMemberAssignment={false}
          />
          <PoolSection
            seasonId={season.id}
            initialPool={initialPool}
            groups={groups.map((group) => ({ id: group.id, name: group.name }))}
          />
        </>
      )}
    </div>
  );
}
