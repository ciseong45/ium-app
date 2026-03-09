"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createOneToOne,
  updateOneToOneStatus,
  deleteOneToOne,
} from "./actions";
import type { OneToOneEntry, OneToOneStatus } from "./actions";
import OneToOneCard from "./OneToOneCard";
import { useRole } from "@/lib/RoleContext";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "진행 중" },
  { value: "paused", label: "일시정지" },
  { value: "completed", label: "완료" },
];

type SimpleMember = { id: number; name: string };

export default function OneToOneView({
  entries,
  members,
  currentStatus,
}: {
  entries: OneToOneEntry[];
  members: SimpleMember[];
  currentStatus: string;
}) {
  const router = useRouter();
  const role = useRole();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const result = await createOneToOne(new FormData(e.currentTarget));
    if (result.success) {
      setShowForm(false);
      router.refresh();
    } else {
      alert(result.error);
    }
    setLoading(false);
  };

  const handleStatusChange = async (id: number, status: OneToOneStatus) => {
    const result = await updateOneToOneStatus(id, status);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 양육 관계를 삭제하시겠습니까? 세션 기록도 모두 삭제됩니다."))
      return;
    const result = await deleteOneToOne(id);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  const activeCount = entries.filter((e) => e.status === "active").length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">1:1 양육</h2>
          <p className="mt-1 text-sm text-gray-500">
            진행 중 {activeCount}건
          </p>
        </div>
        {role !== "viewer" && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + 양육 매칭
          </button>
        )}
      </div>

      {/* 필터 */}
      <div className="mt-4 flex gap-1">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() =>
              router.push(
                `/one-to-one${option.value !== "all" ? `?status=${option.value}` : ""}`
              )
            }
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              currentStatus === option.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 등록 폼 */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 rounded-xl border bg-white p-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                멘토 (양육자) <span className="text-red-500">*</span>
              </label>
              <select
                name="mentor_id"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">선택</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                멘티 (피양육자) <span className="text-red-500">*</span>
              </label>
              <select
                name="mentee_id"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">선택</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              시작일
            </label>
            <input
              name="started_at"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-auto"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "등록 중..." : "매칭 등록"}
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

      {/* 양육 목록 */}
      {entries.length === 0 ? (
        <p className="mt-8 text-center text-gray-400">
          등록된 양육이 없습니다.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {entries.map((entry) => (
            <OneToOneCard
              key={entry.id}
              entry={entry}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
