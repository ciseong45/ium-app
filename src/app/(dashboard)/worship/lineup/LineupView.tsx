"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { saveLineup } from "./actions";
import type {
  WorshipPosition,
  WorshipLineup,
  WorshipLineupSlot,
} from "@/types/worship";
import type { Member } from "@/types/member";
import {
  CARD_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_LABEL_CLASS,
  BTN_PRIMARY_CLASS,
  BTN_SECONDARY_CLASS,
  INPUT_CLASS,
} from "@/components/ui/constants";

type SlotWithMember = WorshipLineupSlot & {
  member_last_name: string;
  member_first_name: string;
  position_name: string;
};

type Props = {
  positions: WorshipPosition[];
  members: Member[];
  memberPositions: { member_id: number; position_id: number; is_capable: boolean }[];
  lineup: WorshipLineup | null;
  slots: SlotWithMember[];
  recentLineups: WorshipLineup[];
  selectedDate: string;
};

type Assignment = { position_id: number; member_id: number; slot_order: number };

export default function LineupView({
  positions,
  members,
  memberPositions,
  lineup,
  slots,
  recentLineups,
  selectedDate,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState(lineup?.comment || "");

  // 현재 배정 상태
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    if (slots.length > 0) {
      return slots.map((s) => ({
        position_id: s.position_id,
        member_id: s.member_id,
        slot_order: s.slot_order,
      }));
    }
    return [];
  });

  // 포지션별 가능 멤버 맵
  const capableMap = useMemo(() => {
    const map = new Map<number, Set<number>>();
    memberPositions.forEach((mp) => {
      if (!map.has(mp.position_id)) map.set(mp.position_id, new Set());
      map.get(mp.position_id)!.add(mp.member_id);
    });
    return map;
  }, [memberPositions]);

  // 이미 배정된 멤버 set
  const assignedMemberIds = useMemo(
    () => new Set(assignments.map((a) => a.member_id)),
    [assignments]
  );

  const getMemberName = (id: number) => {
    const m = members.find((m) => m.id === id);
    return m ? `${m.last_name}${m.first_name}` : "";
  };

  // 포지션별 배정 가져오기
  const getPositionAssignments = (posId: number) =>
    assignments
      .filter((a) => a.position_id === posId)
      .sort((a, b) => a.slot_order - b.slot_order);

  // 포지션에 멤버 추가
  const addToPosition = (posId: number, memberId: number) => {
    const existing = getPositionAssignments(posId);
    setAssignments((prev) => [
      ...prev,
      {
        position_id: posId,
        member_id: memberId,
        slot_order: existing.length,
      },
    ]);
  };

  // 포지션에서 멤버 제거
  const removeFromPosition = (posId: number, memberId: number) => {
    setAssignments((prev) =>
      prev.filter(
        (a) => !(a.position_id === posId && a.member_id === memberId)
      )
    );
  };

  // 자동 배정
  const handleAutoAssign = () => {
    const newAssignments: Assignment[] = [];
    const used = new Set<number>();

    // 포지션 우선순위 순서로 배정
    for (const pos of positions) {
      const capable = capableMap.get(pos.id);
      if (!capable) continue;

      const available = members.filter(
        (m) => capable.has(m.id) && !used.has(m.id)
      );

      if (available.length > 0) {
        // 싱어는 여러명 배정 가능
        const count = pos.name === "싱어" ? Math.min(available.length, 3) : 1;
        for (let i = 0; i < count; i++) {
          if (available[i]) {
            newAssignments.push({
              position_id: pos.id,
              member_id: available[i].id,
              slot_order: i,
            });
            used.add(available[i].id);
          }
        }
      }
    }

    setAssignments(newAssignments);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveLineup(selectedDate, comment || null, assignments);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(false);
  };

  const handleDateChange = (date: string) => {
    router.push(`/worship/lineup?date=${date}`);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className={SECTION_LABEL_CLASS}>Lineup</p>
          <h1 className={PAGE_TITLE_CLASS}>라인업 배정</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-lg border border-[var(--color-warm-border)] bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* 최근 라인업 */}
      {recentLineups.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {recentLineups.map((l) => (
            <button
              key={l.service_date}
              onClick={() => handleDateChange(l.service_date)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-all ${
                l.service_date === selectedDate
                  ? "bg-[#1a1a1a] text-white"
                  : "bg-[var(--color-warm-bg)] text-[var(--color-warm-secondary)] hover:bg-[var(--color-warm-border)]"
              }`}
            >
              {formatDate(l.service_date)}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* 배정 그리드 */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={handleAutoAssign} className={BTN_SECONDARY_CLASS}>
              자동 배정
            </button>
            <button
              onClick={() => setAssignments([])}
              className={BTN_SECONDARY_CLASS}
            >
              초기화
            </button>
          </div>

          {positions.map((pos) => {
            const posAssigns = getPositionAssignments(pos.id);
            const capable = capableMap.get(pos.id) || new Set();
            const availableMembers = members.filter(
              (m) =>
                capable.has(m.id) &&
                !assignedMemberIds.has(m.id) &&
                !posAssigns.some((a) => a.member_id === m.id)
            );

            return (
              <div key={pos.id} className={`${CARD_CLASS} p-4`}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--color-warm-text)]">
                    {pos.name}
                  </p>
                  {availableMembers.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value)
                          addToPosition(pos.id, Number(e.target.value));
                      }}
                      className="rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1 text-xs"
                    >
                      <option value="">+ 추가</option>
                      {availableMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.last_name}{m.first_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {posAssigns.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {posAssigns.map((a) => (
                      <span
                        key={a.member_id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-warm-bg)] px-3 py-1 text-xs text-[var(--color-warm-text)]"
                      >
                        {getMemberName(a.member_id)}
                        <button
                          onClick={() =>
                            removeFromPosition(pos.id, a.member_id)
                          }
                          className="text-[var(--color-warm-muted)] hover:text-red-500"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-warm-muted)]">
                    미배정
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* 사이드: 코멘트 + 저장 */}
        <div className="space-y-4">
          <div className={`${CARD_CLASS} p-4`}>
            <p className={`${SECTION_LABEL_CLASS} mb-2`}>Comment</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="특이사항, 메모..."
              rows={4}
              className={INPUT_CLASS}
            />
          </div>

          <div className={`${CARD_CLASS} p-4`}>
            <p className={`${SECTION_LABEL_CLASS} mb-2`}>Summary</p>
            <p className="text-sm text-[var(--color-warm-secondary)]">
              {assignments.length}개 포지션 배정됨
            </p>
            <p className="text-sm text-[var(--color-warm-secondary)]">
              미배정 멤버: {members.length - assignedMemberIds.size}명
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`${BTN_PRIMARY_CLASS} w-full`}
          >
            {saving ? "저장 중..." : "라인업 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
