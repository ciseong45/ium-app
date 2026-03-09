"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSeason, deleteSeason } from "./actions";
import { useRole } from "@/lib/RoleContext";

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
    if (!confirm(`"${name}" 시즌을 삭제하시겠습니까? 소속 소그룹도 모두 삭제됩니다.`))
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
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + 새 시즌
        </button>
      )}

      {/* 시즌 생성 폼 */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 rounded-xl border bg-white p-4 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">
              시즌 이름 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              placeholder="예: 2026년 상반기"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">
                시작일
              </label>
              <input
                name="start_date"
                type="date"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">
                종료일
              </label>
              <input
                name="end_date"
                type="date"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "생성 중..." : "생성"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* 시즌 목록 */}
      {seasons.length === 0 ? (
        <p className="mt-8 text-center text-gray-400">
          등록된 시즌이 없습니다. 새 시즌을 만들어주세요.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {seasons.map((season) => (
            <div
              key={season.id}
              className="flex items-center justify-between rounded-xl border bg-white p-4 transition-colors hover:border-blue-200"
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => router.push(`/small-groups/${season.id}`)}
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{season.name}</h3>
                  {season.is_active && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      활성
                    </span>
                  )}
                </div>
                {(season.start_date || season.end_date) && (
                  <p className="mt-1 text-sm text-gray-500">
                    {season.start_date || "?"} ~ {season.end_date || "?"}
                  </p>
                )}
              </div>
              {role === "admin" && (
                <button
                  onClick={() => handleDelete(season.id, season.name)}
                  className="ml-4 text-sm text-red-400 hover:text-red-600"
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
