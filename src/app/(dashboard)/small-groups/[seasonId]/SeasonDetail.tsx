"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createGroup,
  deleteGroup,
  assignMember,
  unassignMember,
  updateUpperRoom,
  moveGroupToUpperRoom,
} from "../actions";
import type { Member } from "@/types/member";
import type { UpperRoom, GroupMemberEntry } from "@/types/small-group";
import UpperRoomSection from "./UpperRoomSection";
import { useRole } from "@/lib/RoleContext";

type Group = {
  id: number;
  name: string;
  season_id: number;
  upper_room_id: number;
  leader: { id: number; name: string } | null;
};

type Season = {
  id: number;
  name: string;
  is_active: boolean;
};

export default function SeasonDetail({
  season,
  groups,
  upperRooms,
  unassignedMembers,
  initialGroupMembers,
}: {
  season: Season;
  groups: Group[];
  upperRooms: UpperRoom[];
  unassignedMembers: Member[];
  initialGroupMembers: Record<number, GroupMemberEntry[]>;
}) {
  const router = useRouter();
  const role = useRole();
  const [loading, setLoading] = useState(false);
  const [assigningTo, setAssigningTo] = useState<number | null>(null);
  const [showGroupForm, setShowGroupForm] = useState<number | null>(null);

  // 로컬 상태 — optimistic update 용
  const [localUnassigned, setLocalUnassigned] = useState(unassignedMembers);
  const [groupMembers, setGroupMembers] = useState(initialGroupMembers);

  // 전체 멤버 목록 (다락방장 선택용) = 모든 배정된 멤버 + 미배정 멤버
  const allAssignedMembers = Object.values(groupMembers)
    .flat()
    .map((e) => e.member);
  const allMembers = [
    ...allAssignedMembers,
    ...localUnassigned,
  ].sort((a, b) => a.name.localeCompare(b.name, "ko"));

  // 다락방별 순(그룹) 매핑
  const groupsByUpperRoom = (upperRoomId: number) =>
    groups.filter((g) => g.upper_room_id === upperRoomId);

  const handleCreateGroup = async (upperRoomId: number, formData: FormData) => {
    setLoading(true);
    try {
      await createGroup(season.id, upperRoomId, formData);
      setShowGroupForm(null);
      router.refresh();
    } catch {
      alert("순 생성에 실패했습니다.");
    }
    setLoading(false);
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    if (!confirm(`"${groupName}" 순을 삭제하시겠습니까?`)) return;
    try {
      await deleteGroup(groupId, season.id);
      router.refresh();
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  const handleAssign = async (groupId: number, memberId: number) => {
    const member = localUnassigned.find((m) => m.id === memberId);
    if (!member) return;

    // Optimistic: 미배정에서 제거 → 그룹에 추가
    setLocalUnassigned((prev) => prev.filter((m) => m.id !== memberId));
    setGroupMembers((prev) => ({
      ...prev,
      [groupId]: [
        ...(prev[groupId] || []),
        { id: Date.now(), group_id: groupId, member },
      ],
    }));

    const result = await assignMember(groupId, memberId, season.id);
    if (!result.success) {
      // 롤백
      setLocalUnassigned((prev) =>
        [...prev, member].sort((a, b) => a.name.localeCompare(b.name, "ko"))
      );
      setGroupMembers((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] || []).filter(
          (e) => e.member.id !== memberId
        ),
      }));
      alert(result.error);
    }
  };

  const handleUnassign = async (groupId: number, memberId: number) => {
    const entry = (groupMembers[groupId] || []).find(
      (e) => e.member.id === memberId
    );
    if (!entry) return;

    // Optimistic: 그룹에서 제거 → 미배정에 추가
    setGroupMembers((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] || []).filter(
        (e) => e.member.id !== memberId
      ),
    }));
    setLocalUnassigned((prev) =>
      [...prev, entry.member].sort((a, b) =>
        a.name.localeCompare(b.name, "ko")
      )
    );

    const result = await unassignMember(groupId, memberId, season.id);
    if (!result.success) {
      // 롤백
      setGroupMembers((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] || []), entry],
      }));
      setLocalUnassigned((prev) =>
        prev.filter((m) => m.id !== memberId)
      );
      alert(result.error);
    }
  };

  const handleMoveGroupToUpperRoom = async (groupId: number, upperRoomId: number) => {
    const group = groups.find((g) => g.id === groupId);
    const targetRoom = upperRooms.find((ur) => ur.id === upperRoomId);
    if (!group || !targetRoom) return;
    if (!confirm(`"${group.name}"을(를) ${targetRoom.name}(으)로 이동하시겠습니까?`)) return;

    const result = await moveGroupToUpperRoom(groupId, upperRoomId, season.id);
    if (!result.success) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  const handleUpdateUpperRoom = async (id: number, formData: FormData) => {
    const result = await updateUpperRoom(id, season.id, formData);
    if (!result.success) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  const totalMembers = Object.values(groupMembers).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/small-groups")}
          className="text-gray-400 hover:text-gray-600"
        >
          ←
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{season.name}</h2>
          {season.is_active && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              활성 시즌
            </span>
          )}
        </div>
      </div>

      {/* 요약 */}
      <div className="mt-4 flex gap-4 text-sm text-gray-500">
        <span>다락방 {upperRooms.length}개</span>
        <span>순 {groups.length}개</span>
        <span>배정 {totalMembers}명</span>
        <span>미배정 {localUnassigned.length}명</span>
      </div>

      {/* 다락방 목록 */}
      <div className="mt-6 space-y-4">
        {upperRooms.map((ur) => (
          <UpperRoomSection
            key={ur.id}
            upperRoom={ur}
            groups={groupsByUpperRoom(ur.id)}
            groupMembers={groupMembers}
            assigningTo={assigningTo}
            unassignedMembers={localUnassigned}
            allMembers={allMembers}
            allUpperRooms={upperRooms}
            seasonId={season.id}
            showGroupForm={showGroupForm}
            onToggleGroupForm={setShowGroupForm}
            onSetAssigningTo={setAssigningTo}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
            onDeleteGroup={handleDeleteGroup}
            onCreateGroup={handleCreateGroup}
            onUpdateUpperRoom={handleUpdateUpperRoom}
            onMoveGroupToUpperRoom={handleMoveGroupToUpperRoom}
            loading={loading}
          />
        ))}
      </div>

      {/* 미배정 멤버 */}
      {localUnassigned.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900">
            미배정 멤버 ({localUnassigned.length}명)
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {localUnassigned.map((member) => (
              <span
                key={member.id}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600"
              >
                {member.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
