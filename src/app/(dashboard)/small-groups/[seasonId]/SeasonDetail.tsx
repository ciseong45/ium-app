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

export default function SeasonDetail({
  season,
  groups,
  unassignedMembers,
}: {
  season: Season;
  groups: Group[];
  unassignedMembers: Member[];
}) {
  const router = useRouter();
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assigningTo, setAssigningTo] = useState<number | null>(null);

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
    try {
      await assignMember(groupId, memberId, season.id);
      router.refresh();
    } catch {
      alert("배정에 실패했습니다.");
    }
  };

  const handleUnassign = async (groupId: number, memberId: number) => {
    try {
      await unassignMember(groupId, memberId, season.id);
      router.refresh();
    } catch {
      alert("배정 해제에 실패했습니다.");
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
        <span>미배정 {unassignedMembers.length}명</span>
      </div>

      {/* 소그룹 추가 */}
      <div className="mt-6">
        <button
          onClick={() => setShowGroupForm(!showGroupForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + 소그룹 추가
        </button>
      </div>

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
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        <p className="mt-8 text-center text-gray-400">
          소그룹이 없습니다. 소그룹을 추가해주세요.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              seasonId={season.id}
              isAssigning={assigningTo === group.id}
              unassignedMembers={unassignedMembers}
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
      {unassignedMembers.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900">
            미배정 멤버 ({unassignedMembers.length}명)
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {unassignedMembers.map((member) => (
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
