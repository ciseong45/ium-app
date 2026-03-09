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
  seasonId,
  showGroupForm,
  onToggleGroupForm,
  onSetAssigningTo,
  onAssign,
  onUnassign,
  onDeleteGroup,
  onCreateGroup,
  onUpdateUpperRoom,
  loading,
}: {
  upperRoom: UpperRoom;
  groups: Group[];
  groupMembers: Record<number, GroupMemberEntry[]>;
  assigningTo: number | null;
  unassignedMembers: Member[];
  allMembers: Member[];
  seasonId: number;
  showGroupForm: number | null;
  onToggleGroupForm: (upperRoomId: number | null) => void;
  onSetAssigningTo: (groupId: number | null) => void;
  onAssign: (groupId: number, memberId: number) => void;
  onUnassign: (groupId: number, memberId: number) => void;
  onDeleteGroup: (groupId: number, groupName: string) => void;
  onCreateGroup: (upperRoomId: number, formData: FormData) => void;
  onUpdateUpperRoom: (id: number, formData: FormData) => void;
  loading: boolean;
}) {
  const role = useRole();
  const [collapsed, setCollapsed] = useState(false);
  const [editingLeader, setEditingLeader] = useState(false);

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

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/50">
      {/* 다락방 헤더 */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">
            {collapsed ? "▶" : "▼"}
          </span>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {upperRoom.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {upperRoom.leader ? (
                <span>다락방장: {upperRoom.leader.name}</span>
              ) : (
                <span className="text-gray-400">다락방장 미지정</span>
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
                className="rounded-lg px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {editingLeader ? "닫기" : "다락방장 변경"}
              </button>
              <button
                onClick={() =>
                  onToggleGroupForm(
                    showGroupForm === upperRoom.id ? null : upperRoom.id
                  )
                }
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                + 순 추가
              </button>
            </>
          )}
        </div>
      </div>

      {/* 다락방장 변경 패널 */}
      {editingLeader && (
        <div className="mx-5 mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="mb-2 text-xs font-medium text-blue-700">
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
          className="mx-5 mb-3 rounded-xl border bg-white p-4 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "생성 중..." : "생성"}
            </button>
            <button
              type="button"
              onClick={() => onToggleGroupForm(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* 소그룹(순) 목록 */}
      {!collapsed && (
        <div className="px-5 pb-4">
          {groups.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">소속 순이 없습니다.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  members={groupMembers[group.id] || []}
                  isAssigning={assigningTo === group.id}
                  unassignedMembers={unassignedMembers}
                  onStartAssign={() =>
                    onSetAssigningTo(
                      assigningTo === group.id ? null : group.id
                    )
                  }
                  onAssign={(memberId) => onAssign(group.id, memberId)}
                  onUnassign={(memberId) => onUnassign(group.id, memberId)}
                  onDelete={() => onDeleteGroup(group.id, group.name)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
