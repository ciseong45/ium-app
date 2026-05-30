"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addApplication,
  assignFromPool,
  cancelApplication,
} from "../applications-actions";
import type { Application } from "../applications-actions";
import { useRole } from "@/lib/RoleContext";

type Group = { id: number; name: string };

export default function PoolSection({
  seasonId,
  initialPool,
  groups,
}: {
  seasonId: number;
  initialPool: Application[];
  groups: Group[];
}) {
  const router = useRouter();
  const role = useRole();
  const [pool, setPool] = useState(initialPool);
  const [showAddForm, setShowAddForm] = useState(false);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const isReadOnly = role === "group_leader";

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("season_id", String(seasonId));
      fd.set("source", "admin");
      const result = await addApplication(fd);
      if (result.success) {
        setShowAddForm(false);
        router.refresh();
      } else {
        alert(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (app: Application, groupId: number) => {
    setLoading(true);
    try {
      const result = await assignFromPool({
        applicationId: app.id,
        groupId,
        memberId: app.member_id,
        seasonId,
      });
      if (result.success) {
        setPool((prev) => prev.filter((a) => a.id !== app.id));
        setAssigning(null);
        router.refresh();
      } else {
        alert(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (appId: number) => {
    if (!confirm("신청을 취소하시겠습니까?")) return;
    setLoading(true);
    try {
      const result = await cancelApplication(appId, seasonId);
      if (result.success) {
        setPool((prev) => prev.filter((a) => a.id !== appId));
      } else {
        alert(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-[9px] font-medium uppercase tracking-[0.25em] text-[var(--color-warm-muted)]">
          여름순 풀 ({pool.length}명 미배정)
        </h3>
        {!isReadOnly && (
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="text-xs text-[var(--color-warm-muted)] hover:text-[var(--color-warm-text)] transition-colors"
          >
            {showAddForm ? "닫기" : "+ 신청 추가"}
          </button>
        )}
      </div>

      {/* 신청 추가 폼 */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="mt-3 flex flex-wrap gap-2 items-end rounded-lg border border-[var(--color-warm-border)] bg-white p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[var(--color-warm-muted)]">이름 *</label>
            <input
              name="name"
              required
              className="rounded border border-[var(--color-warm-border)] px-2 py-1 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[var(--color-warm-muted)]">연락처</label>
            <input
              name="phone"
              className="rounded border border-[var(--color-warm-border)] px-2 py-1 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[var(--color-warm-muted)]">메모</label>
            <input
              name="note"
              placeholder="새가족, 방문자 등"
              className="rounded border border-[var(--color-warm-border)] px-2 py-1 text-sm w-44 focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--color-warm-text)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            추가
          </button>
        </form>
      )}

      {/* 풀 목록 */}
      {pool.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-warm-muted)]">미배정 신청자가 없습니다.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {pool.map((app) => (
            <div
              key={app.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-warm-border)] bg-white px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[var(--color-warm-text)]">{app.name}</span>
                {app.note && (
                  <span className="ml-2 text-xs text-[var(--color-warm-muted)]">{app.note}</span>
                )}
                {app.phone && (
                  <span className="ml-2 text-xs text-[var(--color-warm-muted)]">{app.phone}</span>
                )}
                <span className="ml-2 rounded-full bg-[var(--color-warm-bg)] px-2 py-0.5 text-[10px] text-[var(--color-warm-muted)]">
                  {app.source === "form" ? "폼신청" : "관리자"}
                </span>
              </div>

              {!isReadOnly && (
                <div className="flex items-center gap-2">
                  {assigning === app.id ? (
                    <>
                      <select
                        autoFocus
                        className="rounded border border-[var(--color-warm-border)] px-2 py-1 text-xs focus:outline-none"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) handleAssign(app, Number(e.target.value));
                        }}
                        disabled={loading}
                      >
                        <option value="" disabled>순 선택</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setAssigning(null)}
                        className="text-xs text-[var(--color-warm-muted)] hover:text-[var(--color-warm-text)]"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setAssigning(app.id)}
                        disabled={loading || groups.length === 0}
                        className="rounded-lg bg-[var(--color-warm-text)] px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                      >
                        순 배정
                      </button>
                      <button
                        onClick={() => handleCancel(app.id)}
                        disabled={loading}
                        className="text-xs text-[var(--color-warm-muted)] hover:text-red-500 transition-colors"
                      >
                        취소
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
