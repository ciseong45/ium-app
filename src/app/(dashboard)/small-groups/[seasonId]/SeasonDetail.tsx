"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createGroup,
  deleteGroup,
  assignMember,
  unassignMember,
} from "../actions";
import type { Member } from "@/types/member";
import GroupCard from "./GroupCard";
import { useRole } from "@/lib/RoleContext";
import EmptyState from "@/components/ui/EmptyState";
import { INPUT_CLASS } from "@/components/ui/constants";

type Group = {
  id: number;
  name: string;
  season_id: number;
  leader: { id: number; name: string } | null;
};

type Season = {
  id: number;
  name: string;
  is_active: boolean;
};

export type GroupMemberEntry = {
  id: number;
  group_id: number;
  member: Member;
};

export default function SeasonDetail({
  season,
  groups,
  unassignedMembers,
  initialGroupMembers,
}: {
  season: Season;
  groups: Group[];
  unassignedMembers: Member[];
  initialGroupMembers: Record<number, GroupMemberEntry[]>;
}) {
  const router = useRouter();
  const role = useRole();
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assigningTo, setAssigningTo] = useState<number | null>(null);

  // 로컬 상태 — optimistic update 용
  const [localUnassigned, setLocalUnassigned] = useState(unassignedMembers);
  const [groupMembers, setGroupMembers] = useState(initialGroupMembers);

  const handleCreateGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await createGroup(season.id, formData);
      setShowGroupForm(false);
      router.refresh();
    } catch {
      alert("소그룹 생성에 실패했습니다.");
    }
    setLoading(false);
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    if (!confirm(`"${groupName}" 소그룹을 삭제하시겠습니까?`)) return;
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
        <span>소그룹 {groups.length}개</span>
        <span>미배정 {localUnassigned.length}명</span>
      </div>

      {/* 소그룹 추가 */}
      {role === "admin" && (
        <div className="mt-6">
          <button
            onClick={() => setShowGroupForm(!showGroupForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + 소그룹 추가
          </button>
        </div>
      )}

      {showGroupForm && (
        <form
          onSubmit={handleCreateGroup}
          className="mt-4 rounded-xl border bg-white p-4 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">
              그룹명 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              placeholder="예: 1조"
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
              onClick={() => setShowGroupForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* 소그룹 목록 */}
      {groups.length === 0 ? (
        <EmptyState message="소그룹이 없습니다. 소그룹을 추가해주세요." />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              members={groupMembers[group.id] || []}
              isAssigning={assigningTo === group.id}
              unassignedMembers={localUnassigned}
              onStartAssign={() =>
                setAssigningTo(assigningTo === group.id ? null : group.id)
              }
              onAssign={(memberId) => handleAssign(group.id, memberId)}
              onUnassign={(memberId) => handleUnassign(group.id, memberId)}
              onDelete={() => handleDeleteGroup(group.id, group.name)}
            />
          ))}
        </div>
      )}

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
