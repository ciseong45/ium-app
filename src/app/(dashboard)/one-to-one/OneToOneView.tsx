"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createOneToOne,
  updateOneToOneStatus,
  deleteOneToOne,
} from "./actions";
import type { OneToOneEntry, OneToOneStatus } from "@/types/one-to-one";
import OneToOneCard from "./OneToOneCard";
import { useRole } from "@/lib/RoleContext";
import FilterPill from "@/components/ui/FilterPill";
import EmptyState from "@/components/ui/EmptyState";
import { INPUT_CLASS } from "@/components/ui/constants";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "진행 중" },
  { value: "paused", label: "일시정지" },
  { value: "completed", label: "완료" },
];

type SimpleMember = { id: number; last_name: string; first_name: string };

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
          <h2 className="font-serif text-2xl font-light tracking-tight text-[var(--color-warm-text)]">1:1 양육</h2>
          <p className="mt-1 text-sm text-[var(--color-warm-muted)]">
            진행 중 {activeCount}건
          </p>
        </div>
        {role !== "group_leader" && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333]"
          >
            + 양육 매칭
          </button>
        )}
      </div>

      {/* 필터 */}
      <div className="mt-4 flex gap-1">
        {STATUS_OPTIONS.map((option) => (
          <FilterPill
            key={option.value}
            label={option.label}
            active={currentStatus === option.value}
            onClick={() =>
              router.push(
                `/one-to-one${option.value !== "all" ? `?status=${option.value}` : ""}`
              )
            }
          />
        ))}
      </div>

      {/* 등록 폼 */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 rounded-xl border border-[var(--color-warm-border)] bg-white p-6 shadow-[var(--shadow-card)] space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-text)]">
                멘토 (양육자) <span className="text-red-500">*</span>
              </label>
              <select
                name="mentor_id"
                required
                className={INPUT_CLASS}
              >
                <option value="">선택</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.last_name}{m.first_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-text)]">
                멘티 (피양육자) <span className="text-red-500">*</span>
              </label>
              <select
                name="mentee_id"
                required
                className={INPUT_CLASS}
              >
                <option value="">선택</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.last_name}{m.first_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-warm-text)]">
              시작일
            </label>
            <input
              name="started_at"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className={`${INPUT_CLASS} sm:w-auto`}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333] disabled:opacity-50"
            >
              {loading ? "등록 중..." : "매칭 등록"}
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

      {/* 양육 목록 */}
      {entries.length === 0 ? (
        <EmptyState message="등록된 양육이 없습니다." />
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
