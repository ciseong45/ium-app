"use client";

import { useState } from "react";
import type { Member } from "@/types/member";
import type { UpperRoom, GroupMemberEntry } from "@/types/small-group";
import GroupCard from "./GroupCard";
import { useRole } from "@/lib/RoleContext";
import { INPUT_CLASS } from "@/components/ui/constants";

type Group = {
  id: number;
  name: string;
  season_id: number;
  upper_room_id: number;
  leader: { id: number; name: string } | null;
};

export default function UpperRoomSection({
  upperRoom,
  groups,
  groupMembers,
  assigningTo,
  unassignedMembers,
  allMembers,
  allUpperRooms,
  seasonId,
  showGroupForm,
  onToggleGroupForm,
  onSetAssigningTo,
  onAssign,
  onUnassign,
  onDeleteGroup,
  onCreateGroup,
  onUpdateUpperRoom,
  onMoveGroupToUpperRoom,
  loading,
}: {
  upperRoom: UpperRoom;
  groups: Group[];
  groupMembers: Record<number, GroupMemberEntry[]>;
  assigningTo: number | null;
  unassignedMembers: Member[];
  allMembers: Member[];
  allUpperRooms: UpperRoom[];
  seasonId: number;
  showGroupForm: number | null;
  onToggleGroupForm: (upperRoomId: number | null) => void;
  onSetAssigningTo: (groupId: number | null) => void;
  onAssign: (groupId: number, memberId: number) => void;
  onUnassign: (groupId: number, memberId: number) => void;
  onDeleteGroup: (groupId: number, groupName: string) => void;
  onCreateGroup: (upperRoomId: number, formData: FormData) => void;
  onUpdateUpperRoom: (id: number, formData: FormData) => void;
  onMoveGroupToUpperRoom: (groupId: number, upperRoomId: number) => void;
  loading: boolean;
}) {
  const role = useRole();
  const [collapsed, setCollapsed] = useState(false);
  const [editingLeader, setEditingLeader] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(upperRoom.name);

  const totalMembers = groups.reduce(
    (sum, g) => sum + (groupMembers[g.id]?.length || 0),
    0
  );

  const handleLeaderSave = (leaderId: string) => {
    const formData = new FormData();
    formData.set("name", upperRoom.name);
    formData.set("leader_id", leaderId);
    onUpdateUpperRoom(upperRoom.id, formData);
    setEditingLeader(false);
  };

  const handleNameSave = () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === upperRoom.name) {
      setNameValue(upperRoom.name);
      setEditingName(false);
      return;
    }
    const formData = new FormData();
    formData.set("name", trimmed);
    formData.set("leader_id", upperRoom.leader_id ? String(upperRoom.leader_id) : "");
    onUpdateUpperRoom(upperRoom.id, formData);
    setEditingName(false);
  };

  return (
    <div className="rounded-xl border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)]/50 shadow-[var(--shadow-card)]">
      {/* 다락방 헤더 */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`h-4 w-4 text-[var(--color-warm-muted)] transition-transform duration-300 ${collapsed ? "-rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <div>
            {editingName ? (
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") { setNameValue(upperRoom.name); setEditingName(false); }
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-lg font-semibold text-[var(--color-warm-text)] border-b-2 border-[var(--color-warm-text)] bg-transparent outline-none"
              />
            ) : (
              <h3
                className={`text-lg font-semibold text-[var(--color-warm-text)] ${role === "admin" ? "cursor-pointer hover:text-[#333]" : ""}`}
                onClick={(e) => {
                  if (role === "admin") {
                    e.stopPropagation();
                    setEditingName(true);
                  }
                }}
              >
                {upperRoom.name}
              </h3>
            )}
            <div className="flex items-center gap-2 text-sm text-[var(--color-warm-muted)]">
              {upperRoom.leader ? (
                <span>다락방장: {upperRoom.leader.name}</span>
              ) : (
                <span className="text-[var(--color-warm-subtle)]">다락방장 미지정</span>
              )}
              <span>·</span>
              <span>{groups.length}순</span>
              <span>·</span>
              <span>{totalMembers}명</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {role === "admin" && (
            <>
              <button
                onClick={() => setEditingLeader(!editingLeader)}
                className="rounded-lg border border-[var(--color-warm-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-warm-text)] hover:border-[var(--color-warm-text)] transition-all duration-300"
              >
                {editingLeader ? "닫기" : "다락방장 변경"}
              </button>
              <button
                onClick={() =>
                  onToggleGroupForm(
                    showGroupForm === upperRoom.id ? null : upperRoom.id
                  )
                }
                className="rounded-lg bg-[#1a1a1a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#333] transition-all duration-300"
              >
                + 순 추가
              </button>
            </>
          )}
        </div>
      </div>

      {/* 다락방장 변경 패널 */}
      {editingLeader && (
        <div className="mx-5 mb-3 rounded-xl border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] p-3">
          <p className="mb-2 text-xs font-medium text-[var(--color-warm-text)]">
            다락방장을 선택하세요
          </p>
          <select
            defaultValue={upperRoom.leader_id ? String(upperRoom.leader_id) : ""}
            onChange={(e) => handleLeaderSave(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">미지정</option>
            {allMembers.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 순 추가 폼 */}
      {showGroupForm === upperRoom.id && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            onCreateGroup(upperRoom.id, formData);
            e.currentTarget.reset();
          }}
          className="mx-5 mb-3 rounded-xl border border-[var(--color-warm-border)] bg-white p-5 shadow-[var(--shadow-card)] space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-[var(--color-warm-text)]">
              순 이름 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              placeholder="예: 1순"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333] disabled:opacity-50"
            >
              {loading ? "생성 중..." : "생성"}
            </button>
            <button
              type="button"
              onClick={() => onToggleGroupForm(null)}
              className="rounded-lg border border-[var(--color-warm-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--color-warm-text)] transition-all duration-300 hover:border-[var(--color-warm-text)]"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* 순 목록 */}
      {!collapsed && (
        <div className="px-5 pb-4">
          {groups.length === 0 ? (
            <p className="text-sm text-[var(--color-warm-muted)] py-2">소속 순이 없습니다.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  members={groupMembers[group.id] || []}
                  isAssigning={assigningTo === group.id}
                  unassignedMembers={unassignedMembers}
                  upperRooms={allUpperRooms}
                  onStartAssign={() =>
                    onSetAssigningTo(
                      assigningTo === group.id ? null : group.id
                    )
                  }
                  onAssign={(memberId) => onAssign(group.id, memberId)}
                  onUnassign={(memberId) => onUnassign(group.id, memberId)}
                  onDelete={() => onDeleteGroup(group.id, group.name)}
                  onMoveToUpperRoom={(upperRoomId) =>
                    onMoveGroupToUpperRoom(group.id, upperRoomId)
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
