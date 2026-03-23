"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateUserRole, linkMemberToUser, deleteUser, updateUserName } from "./actions";
import type { UserEntry } from "@/types/settings";
import type { UserRole } from "@/lib/auth";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "관리자" },
  { value: "upper_room_leader", label: "다락방장" },
  { value: "group_leader", label: "순장" },
];

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export default function SettingsView({
  users,
  currentUserId,
  members,
}: {
  users: UserEntry[];
  currentUserId: string;
  members: { id: number; last_name: string; first_name: string }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<{ userId: string; value: string } | null>(null);

  const pendingUsers = users.filter((u) => u.role === "pending");
  const activeUsers = users.filter((u) => u.role !== "pending");

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!confirm(`역할을 "${ROLE_OPTIONS.find((r) => r.value === newRole)?.label}"(으)로 변경하시겠습니까?`))
      return;
    setSaving(userId);
    const result = await updateUserRole(userId, newRole);
    if (result.success) router.refresh();
    else alert(result.error);
    setSaving(null);
  };

  const handleMemberLink = async (userId: string, memberId: string) => {
    setSaving(userId);
    const result = await linkMemberToUser(userId, memberId ? Number(memberId) : null);
    if (result.success) router.refresh();
    else alert(result.error);
    setSaving(null);
  };

  const handleApprove = async (userId: string) => {
    setSaving(userId);
    const result = await updateUserRole(userId, "group_leader");
    if (result.success) router.refresh();
    else alert(result.error);
    setSaving(null);
  };

  const handleReject = async (userId: string) => {
    if (!confirm("이 사용자의 가입 요청을 거절하시겠습니까?")) return;
    setSaving(userId);
    const result = await deleteUser(userId);
    if (result.success) router.refresh();
    else alert(result.error);
    setSaving(null);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    setSaving(userId);
    const result = await deleteUser(userId);
    if (result.success) router.refresh();
    else alert(result.error);
    setSaving(null);
  };

  const handleNameSave = async (userId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingName(null);
      return;
    }
    setSaving(userId);
    const result = await updateUserName(userId, newName);
    if (result.success) router.refresh();
    else alert(result.error);
    setEditingName(null);
    setSaving(null);
  };

  const getMemberName = (memberId: number | null) => {
    if (!memberId) return null;
    const m = members.find((m) => m.id === memberId);
    return m ? `${m.last_name}${m.first_name}` : null;
  };

  return (
    <div className="mt-6 space-y-8">
      {/* 승인 대기 섹션 */}
      {pendingUsers.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-lg font-medium text-[var(--color-warm-text)]">
            승인 대기
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {pendingUsers.length}
            </span>
          </h3>
          <div className="mt-3 space-y-3">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-[var(--shadow-card)] border-l-4 border-l-amber-400"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-[var(--color-warm-text)]">
                      {user.name || "이름 없음"}
                    </span>
                    <p className="mt-0.5 text-sm text-[var(--color-warm-muted)]">{user.email}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-warm-muted)]">
                      가입: {formatDate(user.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(user.id)}
                      disabled={saving === user.id}
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleReject(user.id)}
                      disabled={saving === user.id}
                      className="rounded-lg bg-red-50 px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                      거절
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 팀원 관리 섹션 */}
      <section>
        <h3 className="text-lg font-medium text-[var(--color-warm-text)]">팀원 관리</h3>
        <div className="mt-3 space-y-3">
          {activeUsers.map((user) => (
            <div
              key={user.id}
              className="rounded-xl border border-[var(--color-warm-border)] bg-white p-6 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {/* 인라인 이름 편집 */}
                    {editingName?.userId === user.id ? (
                      <input
                        autoFocus
                        value={editingName.value}
                        onChange={(e) => setEditingName({ userId: user.id, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleNameSave(user.id, editingName.value);
                          if (e.key === "Escape") setEditingName(null);
                        }}
                        onBlur={() => handleNameSave(user.id, editingName.value)}
                        className="rounded-md border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] px-2 py-0.5 text-sm font-medium text-[var(--color-warm-text)] focus:border-[var(--color-warm-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/10"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingName({ userId: user.id, value: user.name || "" })}
                        className="font-medium text-[var(--color-warm-text)] hover:underline"
                        title="클릭하여 이름 수정"
                      >
                        {user.name || "이름 없음"}
                      </button>
                    )}
                    {user.id === currentUserId && (
                      <span className="rounded-full bg-[var(--color-warm-bg)] border border-[var(--color-warm-border)] px-1.5 py-0.5 text-xs text-[var(--color-warm-text)]">
                        나
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--color-warm-muted)]">{user.email}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-warm-muted)]">
                    가입: {formatDate(user.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                    disabled={user.id === currentUserId || saving === user.id}
                    className="rounded-lg border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] px-3 py-1.5 text-sm text-[var(--color-warm-text)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/10 disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={saving === user.id}
                      className="rounded-lg p-1.5 text-[var(--color-warm-muted)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="사용자 삭제"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* 멤버 연결 */}
              <div className="mt-2 flex items-center gap-2 border-t border-[var(--color-warm-border-light)] pt-2">
                <span className="text-xs text-[var(--color-warm-muted)] whitespace-nowrap">연결 멤버:</span>
                <select
                  value={user.linked_member_id ? String(user.linked_member_id) : ""}
                  onChange={(e) => handleMemberLink(user.id, e.target.value)}
                  disabled={saving === user.id}
                  className="flex-1 rounded-lg border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] px-2 py-1 text-sm text-[var(--color-warm-text)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/10 disabled:opacity-50"
                >
                  <option value="">미연결</option>
                  {members.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.last_name}{m.first_name}
                    </option>
                  ))}
                </select>
                {user.linked_member_id && (
                  <span className="rounded bg-[#edf5ed] px-1.5 py-0.5 text-xs text-[#3d6b3d]">
                    {getMemberName(user.linked_member_id)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
