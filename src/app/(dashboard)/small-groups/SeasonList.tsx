"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSeason, deleteSeason } from "./actions";
import { useRole } from "@/lib/RoleContext";
import EmptyState from "@/components/ui/EmptyState";
import { INPUT_CLASS } from "@/components/ui/constants";

type Season = {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
};

export default function SeasonList({ seasons }: { seasons: Season[] }) {
  const router = useRouter();
  const role = useRole();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await createSeason(formData);
      setShowForm(false);
      router.refresh();
    } catch {
      alert("시즌 생성에 실패했습니다.");
    }
    setLoading(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 시즌을 삭제하시겠습니까? 소속 순도 모두 삭제됩니다.`))
      return;
    try {
      await deleteSeason(id);
      router.refresh();
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  return (
    <div className="mt-6">
      {role === "admin" && (
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333]"
        >
          + 새 시즌
        </button>
      )}

      {/* 시즌 생성 폼 */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 rounded-xl border border-[var(--color-warm-border)] bg-white p-6 shadow-[var(--shadow-card)] space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-[var(--color-warm-text)]">
              시즌 이름 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              placeholder="예: 2026년 상반기"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-[var(--color-warm-text)]">
                시작일
              </label>
              <input
                name="start_date"
                type="date"
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-[var(--color-warm-text)]">
                종료일
              </label>
              <input
                name="end_date"
                type="date"
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="is_active" type="checkbox" defaultChecked />
            현재 활성 시즌으로 설정
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333] disabled:opacity-50"
            >
              {loading ? "생성 중..." : "생성"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-[var(--color-warm-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--color-warm-text)] transition-all duration-300 hover:border-[var(--color-warm-text)]"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* 시즌 목록 */}
      {seasons.length === 0 ? (
        <EmptyState message="등록된 시즌이 없습니다. 새 시즌을 만들어주세요." />
      ) : (
        <div className="mt-4 space-y-3">
          {seasons.map((season) => (
            <div
              key={season.id}
              className="hover-lift flex items-center justify-between rounded-xl border border-[var(--color-warm-border)] bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:border-[var(--color-warm-text)] hover:shadow-[var(--shadow-card-hover)]"
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => router.push(`/small-groups/${season.id}`)}
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[var(--color-warm-text)]">{season.name}</h3>
                  {season.is_active && (
                    <span className="rounded-full bg-[#edf5ed] px-2 py-0.5 text-xs font-medium text-[#3d6b3d]">
                      활성
                    </span>
                  )}
                </div>
                {(season.start_date || season.end_date) && (
                  <p className="mt-1 text-sm text-[var(--color-warm-muted)]">
                    {season.start_date || "?"} ~ {season.end_date || "?"}
                  </p>
                )}
              </div>
              {role === "admin" && (
                <button
                  onClick={() => handleDelete(season.id, season.name)}
                  className="ml-4 text-sm text-[var(--color-warm-muted)] hover:text-rose-600 transition-all duration-300"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
