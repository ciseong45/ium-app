"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import {
  toggleMemberPosition,
  upsertWorshipAttendance,
  addWorshipMember,
  removeWorshipMember,
  addMemberSchedule,
  deleteMemberSchedule,
} from "./actions";
import type {
  WorshipPosition,
  WorshipAttendanceRecord,
  WorshipMemberSchedule,
  ScheduleType,
} from "@/types/worship";
import type { Member } from "@/types/member";
import { ABSENCE_REASONS, SCHEDULE_TYPE_LABELS, SCHEDULE_TYPE_COLORS } from "@/types/worship";
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
  INPUT_CLASS,
} from "@/components/ui/constants";

type Props = {
  positions: WorshipPosition[];
  members: Member[];
  nonMembers: Member[];
  memberPositions: { member_id: number; position_id: number; is_capable: boolean }[];
  recentAttendance: { records: WorshipAttendanceRecord[]; dates: string[] };
  schedules: WorshipMemberSchedule[];
  currentTab: string;
};

const TAB_OPTIONS = [
  { value: "members", label: "멤버" },
  { value: "attendance", label: "출석" },
  { value: "schedule", label: "스케줄" },
];

export default function WorshipMembersView({
  positions,
  members,
  nonMembers,
  memberPositions,
  recentAttendance,
  schedules,
  currentTab,
}: Props) {
  const router = useRouter();

  const handleTabChange = (tab: string) => {
    router.push(`/worship/members?tab=${tab}`);
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className={SECTION_LABEL_CLASS}>Worship Team</p>
          <h1 className={PAGE_TITLE_CLASS}>예배팀 관리</h1>
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

      {currentTab === "members" ? (
        <MembersTab
          positions={positions}
          members={members}
          nonMembers={nonMembers}
          memberPositions={memberPositions}
        />
      ) : currentTab === "attendance" ? (
        <AttendanceTab
          members={members}
          recentAttendance={recentAttendance}
        />
      ) : (
        <ScheduleTab members={members} schedules={schedules} />
      )}
    </div>
  );
}

// ── 멤버 관리 탭 ──

function MembersTab({
  positions,
  members,
  nonMembers,
  memberPositions,
}: {
  positions: WorshipPosition[];
  members: Member[];
  nonMembers: Member[];
  memberPositions: { member_id: number; position_id: number; is_capable: boolean }[];
}) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [adding, setAdding] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const posMap = useMemo(() => {
    const map = new Map<string, boolean>();
    memberPositions.forEach((mp) => {
      map.set(`${mp.member_id}-${mp.position_id}`, mp.is_capable);
    });
    return map;
  }, [memberPositions]);

  const filteredNonMembers = useMemo(() => {
    if (!addSearch) return nonMembers;
    const q = addSearch.toLowerCase();
    return nonMembers.filter(
      (m) =>
        `${m.last_name}${m.first_name}`.toLowerCase().includes(q) ||
        `${m.first_name}${m.last_name}`.toLowerCase().includes(q)
    );
  }, [nonMembers, addSearch]);

  const handleAddMember = async (memberId: number) => {
    setAdding(memberId);
    const result = await addWorshipMember(memberId);
    if (result.success) {
      router.refresh();
      setShowAddModal(false);
      setAddSearch("");
    } else {
      alert(result.error);
    }
    setAdding(null);
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm("예배팀에서 제거하시겠습니까? 포지션 배정도 함께 삭제됩니다.")) return;
    setRemoving(memberId);
    const result = await removeWorshipMember(memberId);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setRemoving(null);
  };

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

  if (members.length === 0) {
    return (
      <div>
        <div className="mb-4 flex justify-end">
          <button onClick={() => setShowAddModal(true)} className={BTN_PRIMARY_CLASS}>
            멤버 추가
          </button>
        </div>
        <EmptyState message="예배팀에 등록된 멤버가 없습니다." />
        {showAddModal && (
          <AddMemberModal
            filteredNonMembers={filteredNonMembers}
            addSearch={addSearch}
            setAddSearch={setAddSearch}
            adding={adding}
            onAdd={handleAddMember}
            onClose={() => { setShowAddModal(false); setAddSearch(""); }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowAddModal(true)} className={BTN_PRIMARY_CLASS}>
          멤버 추가
        </button>
      </div>

      {/* 포지션 매트릭스 + 제거 버튼 */}
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
              <th className="px-3 py-3 text-center whitespace-nowrap">관리</th>
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
                <td className="px-3 py-3 text-center">
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={removing === member.id}
                    className="text-xs text-[var(--color-warm-muted)] transition-colors hover:text-rose-500"
                  >
                    {removing === member.id ? "..." : "제거"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 멤버 추가 모달 */}
      {showAddModal && (
        <AddMemberModal
          filteredNonMembers={filteredNonMembers}
          addSearch={addSearch}
          setAddSearch={setAddSearch}
          adding={adding}
          onAdd={handleAddMember}
          onClose={() => { setShowAddModal(false); setAddSearch(""); }}
        />
      )}
    </div>
  );
}

function AddMemberModal({
  filteredNonMembers,
  addSearch,
  setAddSearch,
  adding,
  onAdd,
  onClose,
}: {
  filteredNonMembers: Member[];
  addSearch: string;
  setAddSearch: (v: string) => void;
  adding: number | null;
  onAdd: (id: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className={`${CARD_CLASS} w-full max-w-md p-6`}>
        <p className={`${SECTION_LABEL_CLASS} mb-2`}>멤버 추가</p>
        <p className="mb-4 text-sm text-[var(--color-warm-secondary)]">
          예배팀에 추가할 멤버를 선택하세요
        </p>

        <input
          type="text"
          placeholder="이름 검색..."
          value={addSearch}
          onChange={(e) => setAddSearch(e.target.value)}
          className={INPUT_CLASS}
        />

        <div className="mt-4 max-h-60 overflow-y-auto">
          {filteredNonMembers.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--color-warm-muted)]">
              추가 가능한 멤버가 없습니다
            </p>
          ) : (
            <div className="space-y-1">
              {filteredNonMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onAdd(m.id)}
                  disabled={adding === m.id}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-[var(--color-warm-bg)]"
                >
                  <span className="font-medium text-[var(--color-warm-text)]">
                    {m.last_name}{m.first_name}
                  </span>
                  <span className="text-xs text-[var(--color-warm-muted)]">
                    {adding === m.id ? "추가 중..." : "추가"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className={BTN_SECONDARY_CLASS}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 출석 현황 탭 ──

function AttendanceTab({
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

  if (members.length === 0) {
    return <EmptyState message="예배팀에 등록된 멤버가 없습니다." />;
  }

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

// ── 스케줄 (Off/OOT) 탭 ──

function ScheduleTab({
  members,
  schedules,
}: {
  members: Member[];
  schedules: WorshipMemberSchedule[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    memberId: "",
    startDate: "",
    endDate: "",
    type: "off" as ScheduleType,
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const memberMap = useMemo(() => {
    const map = new Map<number, Member>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const handleSubmit = async () => {
    if (!formData.memberId || !formData.startDate || !formData.endDate) return;
    setSaving(true);
    const result = await addMemberSchedule(
      Number(formData.memberId),
      formData.startDate,
      formData.endDate,
      formData.type,
      formData.note || null
    );
    if (result.success) {
      setShowForm(false);
      setFormData({ memberId: "", startDate: "", endDate: "", type: "off", note: "" });
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("스케줄을 삭제하시겠습니까?")) return;
    setDeleting(id);
    const result = await deleteMemberSchedule(id);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setDeleting(null);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowForm(true)} className={BTN_PRIMARY_CLASS}>
          스케줄 등록
        </button>
      </div>

      {schedules.length === 0 ? (
        <EmptyState message="등록된 스케줄이 없습니다." />
      ) : (
        <div className={`${CARD_CLASS} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_HEADER_CLASS}>
                <th className="px-4 py-3 text-left">멤버</th>
                <th className="px-3 py-3 text-center">타입</th>
                <th className="px-3 py-3 text-center">시작</th>
                <th className="px-3 py-3 text-center">종료</th>
                <th className="px-3 py-3 text-left">메모</th>
                <th className="px-3 py-3 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => {
                const member = memberMap.get(schedule.member_id);
                return (
                  <tr key={schedule.id} className={TABLE_ROW_CLASS}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {member
                        ? `${member.last_name}${member.first_name}`
                        : `#${schedule.member_id}`}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          SCHEDULE_TYPE_COLORS[schedule.type as ScheduleType] || ""
                        }`}
                      >
                        {SCHEDULE_TYPE_LABELS[schedule.type as ScheduleType] || schedule.type}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      {formatDate(schedule.start_date)}
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      {formatDate(schedule.end_date)}
                    </td>
                    <td className="px-3 py-3 text-[var(--color-warm-secondary)]">
                      {schedule.note || "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        disabled={deleting === schedule.id}
                        className="text-xs text-[var(--color-warm-muted)] transition-colors hover:text-rose-500"
                      >
                        {deleting === schedule.id ? "..." : "삭제"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 등록 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className={`${CARD_CLASS} w-full max-w-md p-6`}>
            <p className={`${SECTION_LABEL_CLASS} mb-2`}>스케줄 등록</p>
            <p className="mb-4 text-sm text-[var(--color-warm-secondary)]">
              Off/OOT 날짜를 등록합니다
            </p>

            <div className="space-y-3">
              <select
                value={formData.memberId}
                onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                className={SELECT_CLASS}
              >
                <option value="">멤버 선택</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.last_name}{m.first_name}
                  </option>
                ))}
              </select>

              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as ScheduleType })
                }
                className={SELECT_CLASS}
              >
                {(Object.entries(SCHEDULE_TYPE_LABELS) as [ScheduleType, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--color-warm-muted)]">시작일</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-warm-muted)]">종료일</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <input
                type="text"
                placeholder="메모 (선택)"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className={BTN_SECONDARY_CLASS}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !formData.memberId || !formData.startDate || !formData.endDate}
                className={BTN_PRIMARY_CLASS}
              >
                {saving ? "저장 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
