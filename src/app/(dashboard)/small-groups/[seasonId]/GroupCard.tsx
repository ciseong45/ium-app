"use client";

import type { Member } from "@/types/member";
import { useRole } from "@/lib/RoleContext";
import type { GroupMemberEntry } from "./SeasonDetail";

type Group = {
  id: number;
  name: string;
  leader: { id: number; name: string } | null;
};

export default function GroupCard({
  group,
  members,
  isAssigning,
  unassignedMembers,
  onStartAssign,
  onAssign,
  onUnassign,
  onDelete,
}: {
  group: Group;
  members: GroupMemberEntry[];
  isAssigning: boolean;
  unassignedMembers: Member[];
  onStartAssign: () => void;
  onAssign: (memberId: number) => void;
  onUnassign: (memberId: number) => void;
  onDelete: () => void;
}) {
  const role = useRole();

  return (
    <div className="rounded-xl border bg-white p-4">
      {/* 그룹 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{group.name}</h3>
          {group.leader && (
            <p className="text-sm text-gray-500">리더: {group.leader.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          {role !== "viewer" && (
            <button
              onClick={onStartAssign}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isAssigning
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isAssigning ? "닫기" : "+ 배정"}
            </button>
          )}
          {role === "admin" && (
            <button
              onClick={onDelete}
              className="rounded-lg px-3 py-1.5 text-xs text-red-400 hover:text-red-600"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {/* 배정 패널 */}
      {isAssigning && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="mb-2 text-xs font-medium text-blue-700">
            멤버를 클릭하면 이 그룹에 배정됩니다
          </p>
          {unassignedMembers.length === 0 ? (
            <p className="text-xs text-gray-400">미배정 멤버가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {unassignedMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => onAssign(member.id)}
                  className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 shadow-sm hover:bg-blue-100"
                >
                  {member.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 소속 멤버 목록 */}
      <div className="mt-3">
        {members.length === 0 ? (
          <p className="text-xs text-gray-400">소속 멤버가 없습니다.</p>
        ) : (
          <div className="space-y-1">
            {members.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-gray-50"
              >
                <span className="text-sm text-gray-700">
                  {entry.member.name}
                </span>
                {role !== "viewer" && (
                  <button
                    onClick={() => onUnassign(entry.member.id)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    해제
                  </button>
                )}
              </div>
            ))}
            <p className="mt-1 text-xs text-gray-400">
              {members.length}명
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
