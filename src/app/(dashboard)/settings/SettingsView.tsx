"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateUserRole } from "./actions";
import type { UserEntry } from "./actions";
import type { UserRole } from "@/lib/auth";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "관리자" },
  { value: "leader", label: "리더" },
  { value: "viewer", label: "뷰어" },
];

export default function SettingsView({
  users,
  currentUserId,
}: {
  users: UserEntry[];
  currentUserId: string;
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

  return (
    <div className="mt-6 space-y-3">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between rounded-xl border bg-white p-4"
        >
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
      ))}
    </div>
  );
}
