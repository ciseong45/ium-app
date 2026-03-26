"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { toggleMemberPosition, upsertWorshipAttendance } from "./actions";
import type { WorshipPosition, WorshipAttendanceRecord } from "@/types/worship";
import type { Member } from "@/types/member";
import { ABSENCE_REASONS } from "@/types/worship";
import FilterPill from "@/components/ui/FilterPill";
import EmptyState from "@/components/ui/EmptyState";
import {
  CARD_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_LABEL_CLASS,
  TABLE_HEADER_CLASS,
  TABLE_ROW_CLASS,
  BTN_PRIMARY_CLASS,
  BTN_SECONDARY_CLASS,
  SELECT_CLASS,
} from "@/components/ui/constants";

type Props = {
  positions: WorshipPosition[];
  members: Member[];
  memberPositions: { member_id: number; position_id: number; is_capable: boolean }[];
  recentAttendance: { records: WorshipAttendanceRecord[]; dates: string[] };
  currentTab: string;
};

const TAB_OPTIONS = [
  { value: "positions", label: "포지션 매트릭스" },
  { value: "attendance", label: "출석 현황" },
  { value: "groups", label: "나눔 소그룹" },
];

export default function WorshipTeamView({
  positions,
  members,
  memberPositions,
  recentAttendance,
  currentTab,
}: Props) {
  const router = useRouter();

  const handleTabChange = (tab: string) => {
    router.push(`/worship/team?tab=${tab}`);
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className={SECTION_LABEL_CLASS}>Worship Team</p>
          <h1 className={PAGE_TITLE_CLASS}>찬양팀 관리</h1>
        </div>
        <p className="text-sm text-[var(--color-warm-secondary)]">
          {members.length}명
        </p>
      </div>

      {/* 탭 */}
      <div className="mb-6 flex gap-1 border-b border-[var(--color-warm-border)]">
        {TAB_OPTIONS.map((tab) => (
          <FilterPill
            key={tab.value}
            label={tab.label}
            active={currentTab === tab.value}
            onClick={() => handleTabChange(tab.value)}
          />
        ))}
      </div>

      {members.length === 0 ? (
        <EmptyState message="찬양팀에 등록된 멤버가 없습니다. 멤버 관리에서 사역팀을 지정해주세요." />
      ) : currentTab === "positions" ? (
        <PositionMatrix
          positions={positions}
          members={members}
          memberPositions={memberPositions}
        />
      ) : currentTab === "attendance" ? (
        <AttendanceGrid
          members={members}
          recentAttendance={recentAttendance}
        />
      ) : (
        <FellowshipGroups members={members} />
      )}
    </div>
  );
}

// ── 포지션 매트릭스 ──

function PositionMatrix({
  positions,
  members,
  memberPositions,
}: {
  positions: WorshipPosition[];
  members: Member[];
  memberPositions: { member_id: number; position_id: number; is_capable: boolean }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const posMap = useMemo(() => {
    const map = new Map<string, boolean>();
    memberPositions.forEach((mp) => {
      map.set(`${mp.member_id}-${mp.position_id}`, mp.is_capable);
    });
    return map;
  }, [memberPositions]);

  const handleToggle = async (memberId: number, positionId: number) => {
    const key = `${memberId}-${positionId}`;
    setLoading(key);
    const isCurrent = posMap.has(key);
    const result = await toggleMemberPosition(memberId, positionId, isCurrent);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setLoading(null);
  };

  return (
    <div className={`${CARD_CLASS} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={TABLE_HEADER_CLASS}>
            <th className="sticky left-0 bg-[var(--color-warm-bg)] px-4 py-3 text-left">
              멤버
            </th>
            {positions.map((pos) => (
              <th key={pos.id} className="px-3 py-3 text-center whitespace-nowrap">
                {pos.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className={TABLE_ROW_CLASS}>
              <td className="sticky left-0 bg-white px-4 py-3 font-medium whitespace-nowrap">
                {member.last_name}{member.first_name}
              </td>
              {positions.map((pos) => {
                const key = `${member.id}-${pos.id}`;
                const capable = posMap.has(key);
                const isLoading = loading === key;

                return (
                  <td key={pos.id} className="px-3 py-3 text-center">
                    <button
                      onClick={() => handleToggle(member.id, pos.id)}
                      disabled={isLoading}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-all duration-200 ${
                        capable
                          ? "bg-[#1a1a1a] text-white"
                          : "bg-[var(--color-warm-bg)] text-[var(--color-warm-muted)] hover:bg-[var(--color-warm-border)]"
                      } ${isLoading ? "opacity-50" : ""}`}
                    >
                      {capable ? "✓" : ""}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 출석 현황 ──

function AttendanceGrid({
  members,
  recentAttendance,
}: {
  members: Member[];
  recentAttendance: { records: WorshipAttendanceRecord[]; dates: string[] };
}) {
  const router = useRouter();
  const [editCell, setEditCell] = useState<{
    memberId: number;
    date: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const { records, dates } = recentAttendance;

  const recordMap = useMemo(() => {
    const map = new Map<string, WorshipAttendanceRecord>();
    records.forEach((r) => {
      map.set(`${r.member_id}-${r.week_date}`, r);
    });
    return map;
  }, [records]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const handleCellClick = (memberId: number, date: string) => {
    const record = recordMap.get(`${memberId}-${date}`);
    if (record && !record.is_present) {
      setReason(record.absence_reason || "");
    } else {
      setReason("");
    }
    setEditCell({ memberId, date });
  };

  const handleMarkPresent = async () => {
    if (!editCell) return;
    setSaving(true);
    const result = await upsertWorshipAttendance(
      editCell.memberId,
      editCell.date,
      true,
      null
    );
    if (result.success) {
      setEditCell(null);
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(false);
  };

  const handleMarkAbsent = async () => {
    if (!editCell || !reason) return;
    setSaving(true);
    const result = await upsertWorshipAttendance(
      editCell.memberId,
      editCell.date,
      false,
      reason
    );
    if (result.success) {
      setEditCell(null);
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(false);
  };

  if (dates.length === 0) {
    return <EmptyState message="아직 출석 기록이 없습니다." />;
  }

  return (
    <>
      <div className={`${CARD_CLASS} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={TABLE_HEADER_CLASS}>
              <th className="sticky left-0 bg-[var(--color-warm-bg)] px-4 py-3 text-left">
                멤버
              </th>
              {dates.map((date) => (
                <th key={date} className="px-3 py-3 text-center whitespace-nowrap">
                  {formatDate(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className={TABLE_ROW_CLASS}>
                <td className="sticky left-0 bg-white px-4 py-3 font-medium whitespace-nowrap">
                  {member.last_name}{member.first_name}
                </td>
                {dates.map((date) => {
                  const record = recordMap.get(`${member.id}-${date}`);
                  const isEditing =
                    editCell?.memberId === member.id &&
                    editCell?.date === date;

                  let cellContent = "";
                  let cellClass =
                    "text-[var(--color-warm-muted)] hover:bg-[var(--color-warm-bg)]";

                  if (record) {
                    if (record.is_present) {
                      cellContent = "○";
                      cellClass = "text-[#3d6b3d]";
                    } else {
                      cellContent = record.absence_reason || "✕";
                      cellClass = "text-[#b05a20] bg-[#fef3e8]/50";
                    }
                  }

                  return (
                    <td
                      key={date}
                      onClick={() => handleCellClick(member.id, date)}
                      className={`px-2 py-3 text-center text-xs cursor-pointer whitespace-nowrap transition-colors ${cellClass} ${
                        isEditing ? "ring-2 ring-[#1a1a1a] ring-inset" : ""
                      }`}
                    >
                      {cellContent || "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 편집 모달 */}
      {editCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className={`${CARD_CLASS} w-full max-w-sm p-6`}>
            <p className={`${SECTION_LABEL_CLASS} mb-2`}>출석 기록</p>
            <p className="mb-4 text-sm text-[var(--color-warm-secondary)]">
              {members.find((m) => m.id === editCell.memberId)?.last_name}
              {members.find((m) => m.id === editCell.memberId)?.first_name} —{" "}
              {editCell.date}
            </p>

            <div className="mb-4 flex gap-2">
              <button
                onClick={handleMarkPresent}
                disabled={saving}
                className={BTN_PRIMARY_CLASS}
              >
                출석
              </button>
            </div>

            <div className="mb-4">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">사유 선택</option>
                {ABSENCE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleMarkAbsent}
                disabled={saving || !reason}
                className={BTN_PRIMARY_CLASS}
              >
                결석 처리
              </button>
              <button
                onClick={() => setEditCell(null)}
                className={BTN_SECONDARY_CLASS}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── 나눔 소그룹 ──

function FellowshipGroups({ members }: { members: Member[] }) {
  const [groupCount, setGroupCount] = useState(3);
  const [selected, setSelected] = useState<Set<number>>(
    new Set(members.map((m) => m.id))
  );
  const [groups, setGroups] = useState<Member[][]>([]);

  const toggleMember = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRandomize = () => {
    const available = members.filter((m) => selected.has(m.id));
    // Fisher-Yates shuffle
    const shuffled = [...available];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const result: Member[][] = Array.from({ length: groupCount }, () => []);
    shuffled.forEach((member, i) => {
      result[i % groupCount].push(member);
    });
    setGroups(result);
  };

  return (
    <div>
      {/* 멤버 선택 */}
      <div className={`${CARD_CLASS} mb-6 p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--color-warm-text)]">
            참석 인원 선택 ({selected.size}명)
          </p>
          <div className="flex items-center gap-3">
            <label className="text-xs text-[var(--color-warm-secondary)]">
              그룹 수
            </label>
            <select
              value={groupCount}
              onChange={(e) => setGroupCount(Number(e.target.value))}
              className="rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1 text-sm"
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button onClick={handleRandomize} className={BTN_PRIMARY_CLASS}>
              랜덤 배정
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => toggleMember(m.id)}
              className={`rounded-full px-3 py-1.5 text-xs transition-all ${
                selected.has(m.id)
                  ? "bg-[#1a1a1a] text-white"
                  : "bg-[var(--color-warm-bg)] text-[var(--color-warm-muted)] hover:bg-[var(--color-warm-border)]"
              }`}
            >
              {m.last_name}{m.first_name}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 */}
      {groups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, i) => (
            <div key={i} className={`${CARD_CLASS} p-5`}>
              <p className={`${SECTION_LABEL_CLASS} mb-3`}>Group {i + 1}</p>
              <div className="space-y-1.5">
                {group.map((m) => (
                  <p
                    key={m.id}
                    className="text-sm text-[var(--color-warm-text)]"
                  >
                    {m.last_name}{m.first_name}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--color-warm-muted)]">
                {group.length}명
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
