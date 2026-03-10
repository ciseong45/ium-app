"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateUserRole, linkMemberToUser } from "./actions";
import type { UserEntry } from "@/types/settings";
import type { UserRole } from "@/lib/auth";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "관리자" },
  { value: "upper_room_leader", label: "다락방장" },
  { value: "group_leader", label: "순장" },
];

export default function SettingsView({
  users,
  currentUserId,
  members,
}: {
  users: UserEntry[];
  currentUserId: string;
  members: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!confirm(`역할을 "${ROLE_OPTIONS.find((r) => r.value === newRole)?.label}"(으)로 변경하시겠습니까?`))
      return;
    setSaving(userId);
    const result = await updateUserRole(userId, newRole);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(null);
  };

  const handleMemberLink = async (userId: string, memberId: string) => {
    setSaving(userId);
    const result = await linkMemberToUser(
      userId,
      memberId ? Number(memberId) : null
    );
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(null);
  };

  const getMemberName = (memberId: number | null) => {
    if (!memberId) return null;
    return members.find((m) => m.id === memberId)?.name ?? null;
  };

  return (
    <div className="mt-6 space-y-3">
      {users.map((user) => (
        <div
          key={user.id}
          className="rounded-xl border bg-white p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {user.name || "이름 없음"}
                </span>
                {user.id === currentUserId && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
                    나
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">{user.email}</p>
            </div>
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
              disabled={user.id === currentUserId || saving === user.id}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 멤버 연결 */}
          <div className="mt-2 flex items-center gap-2 border-t pt-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">연결 멤버:</span>
            <select
              value={user.linked_member_id ? String(user.linked_member_id) : ""}
              onChange={(e) => handleMemberLink(user.id, e.target.value)}
              disabled={saving === user.id}
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">미연결</option>
              {members.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name}
                </option>
              ))}
            </select>
            {user.linked_member_id && (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                {getMemberName(user.linked_member_id)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
