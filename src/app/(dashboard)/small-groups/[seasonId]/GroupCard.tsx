"use client";

import Link from "next/link";
import type { Member } from "@/types/member";
import type { GroupMemberEntry, UpperRoom } from "@/types/small-group";
import { useRole } from "@/lib/RoleContext";

type Group = {
  id: number;
  name: string;
  upper_room_id: number;
  leader: { id: number; last_name: string; first_name: string } | null;
};

export default function GroupCard({
  group,
  members,
  isAssigning,
  unassignedMembers,
  upperRooms,
  onStartAssign,
  onAssign,
  onUnassign,
  onDelete,
  onMoveToUpperRoom,
}: {
  group: Group;
  members: GroupMemberEntry[];
  isAssigning: boolean;
  unassignedMembers: Member[];
  upperRooms: UpperRoom[];
  onStartAssign: () => void;
  onAssign: (memberId: number) => void;
  onUnassign: (memberId: number) => void;
  onDelete: () => void;
  onMoveToUpperRoom: (upperRoomId: number) => void;
}) {
  const role = useRole();

  return (
    <div className="hover-lift rounded-xl border border-[var(--color-warm-border)] bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-card-hover)]">
      {/* 그룹 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[var(--color-warm-text)]">{group.name}</h3>
          {group.leader && (
            <p className="text-sm text-[var(--color-warm-muted)]">리더: {group.leader.last_name}{group.leader.first_name}</p>
          )}
        </div>
        <div className="flex gap-2">
          {role !== "group_leader" && (
            <button
              onClick={onStartAssign}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
                isAssigning
                  ? "bg-[#1a1a1a] text-white"
                  : "border border-[var(--color-warm-border)] bg-white text-[var(--color-warm-text)] hover:border-[var(--color-warm-text)]"
              }`}
            >
              {isAssigning ? "닫기" : "+ 배정"}
            </button>
          )}
          {role === "admin" && (
            <>
              <select
                value=""
                onChange={(e) => {
                  const targetId = Number(e.target.value);
                  if (targetId) onMoveToUpperRoom(targetId);
                }}
                className="rounded-lg border border-[var(--color-warm-border)] px-2 py-1 text-xs text-[var(--color-warm-muted)] focus:border-[var(--color-warm-text)] focus:outline-none transition-all duration-300"
              >
                <option value="" disabled>이동</option>
                {upperRooms
                  .filter((ur) => ur.id !== group.upper_room_id)
                  .map((ur) => (
                    <option key={ur.id} value={ur.id}>
                      → {ur.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={onDelete}
                className="rounded-lg px-3 py-1.5 text-xs text-rose-400 hover:text-rose-600 transition-all duration-300"
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      {/* 배정 패널 */}
      {isAssigning && (
        <div className="mt-3 rounded-xl border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] p-3">
          <p className="mb-2 text-xs font-medium text-[var(--color-warm-text)]">
            멤버를 클릭하면 이 그룹에 배정됩니다
          </p>
          {unassignedMembers.length === 0 ? (
            <p className="text-xs text-[var(--color-warm-muted)]">미배정 멤버가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {unassignedMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => onAssign(member.id)}
                  className="rounded-full bg-white px-2.5 py-1 text-xs text-[var(--color-warm-text)] shadow-sm hover:bg-[var(--color-warm-border-light)] transition-all duration-300"
                >
                  {member.last_name}{member.first_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 소속 멤버 목록 */}
      <div className="mt-3">
        {members.length === 0 ? (
          <p className="text-xs text-[var(--color-warm-muted)]">소속 멤버가 없습니다.</p>
        ) : (
          <div className="space-y-1">
            {members.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-[var(--color-warm-bg)] transition-all duration-300"
              >
                <Link
                  href={`/members/${entry.member.id}`}
                  className="text-sm text-[var(--color-warm-text)] hover:underline"
                >
                  {entry.member.last_name}{entry.member.first_name}
                </Link>
                {role !== "group_leader" && (
                  <button
                    onClick={() => onUnassign(entry.member.id)}
                    className="text-xs text-[var(--color-warm-muted)] hover:text-red-500"
                  >
                    해제
                  </button>
                )}
              </div>
            ))}
            <p className="mt-1 text-xs text-[var(--color-warm-muted)]">
              {members.length}명
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
