"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  createNewFamily,
  updateStep,
  deleteNewFamily,
} from "./actions";
import type { NewFamilyEntry, Season } from "@/types/new-family";
import { useRole } from "@/lib/RoleContext";
import FilterPill from "@/components/ui/FilterPill";
import EmptyState from "@/components/ui/EmptyState";
import { INPUT_CLASS } from "@/components/ui/constants";

const STEPS = [
  { step: 1, label: "1주차 방문", color: "bg-[var(--color-warm-bg)] text-[var(--color-warm-text)]" },
  { step: 2, label: "2주차 교육", color: "bg-[#f0f4ed] text-[#4a6741]" },
  { step: 3, label: "3주차 교육", color: "bg-[#edf5ed] text-[#3d6b3d]" },
];

type SimpleMember = { id: number; name: string };

export default function NewFamilyView({
  families,
  members,
  seasons,
  currentSeasonId,
}: {
  families: NewFamilyEntry[];
  members: SimpleMember[];
  seasons: Season[];
  currentSeasonId?: number;
}) {
  const router = useRouter();
  const role = useRole();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stepFilter, setStepFilter] = useState<number | null>(null);

  const activeSeason = seasons.find((s) => s.is_active);

  const handleSeasonFilter = (seasonId: string) => {
    if (seasonId === "all") {
      router.push("/new-family");
    } else {
      router.push(`/new-family?season=${seasonId}`);
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const result = await createNewFamily(new FormData(e.currentTarget));
    if (result.success) {
      setShowForm(false);
      router.refresh();
    } else {
      alert(result.error);
    }
    setLoading(false);
  };

  const handleStepChange = async (id: number, step: number) => {
    if (step === 3) {
      if (!confirm("3주차 교육을 완료하면 '적응중' 상태로 변경됩니다. 3개월 후 자동으로 출석 멤버가 됩니다. 진행하시겠습니까?")) return;
    }
    const result = await updateStep(id, step);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`${name}님을 새가족 목록에서 삭제하시겠습니까?`)) return;
    const result = await deleteNewFamily(id);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  // 단계별 통계
  const stepCounts = useMemo(() => STEPS.map((s) => ({
    ...s,
    count: families.filter((f) => f.step === s.step).length,
  })), [families]);

  // 2주 이상 단계 변화 없는 새가족
  const stalled = useMemo(() => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    return families.filter(
      (f) => f.step < 3 && new Date(f.step_updated_at) < twoWeeksAgo
    );
  }, [families]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-light tracking-tight text-[var(--color-warm-text)]">새가족</h2>
        {role !== "group_leader" && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333]"
          >
            + 새가족 등록
          </button>
        )}
      </div>

      {/* 시즌 필터 */}
      {seasons.length > 0 && (
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
          <FilterPill
            label="전체"
            active={!currentSeasonId}
            onClick={() => handleSeasonFilter("all")}
          />
          {seasons.map((season) => (
            <FilterPill
              key={season.id}
              label={`${season.name}${season.is_active ? " (현재)" : ""}`}
              active={currentSeasonId === season.id}
              onClick={() => handleSeasonFilter(String(season.id))}
            />
          ))}
        </div>
      )}

      {/* 단계별 요약 (클릭 시 필터) */}
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {stepCounts.map((s) => (
          <button
            key={s.step}
            onClick={() => setStepFilter(stepFilter === s.step ? null : s.step)}
            className={`flex min-w-[100px] flex-col items-center rounded-xl border p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-card-hover)] ${
              stepFilter === s.step
                ? "border-[var(--color-warm-text)] bg-white ring-1 ring-[var(--color-warm-text)]/10"
                : "border-[var(--color-warm-border)] bg-white hover:border-[var(--color-warm-text)]"
            }`}
          >
            <span className="text-xs text-[var(--color-warm-muted)]">{s.label}</span>
            <span className="mt-1 text-2xl font-bold text-[var(--color-warm-text)]">
              {s.count}
            </span>
          </button>
        ))}
      </div>

      {/* 장기 미진행 경고 */}
      {stalled.length > 0 && (
        <div className="mt-4 rounded-xl border border-[#e5dfd3] bg-[#fdfbf5] p-4">
          <h3 className="text-sm font-semibold text-[#8a7a56]">
            2주 이상 단계 변화 없음
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {stalled.map((f) => (
              <span
                key={f.id}
                className="rounded-full bg-[#f5f0e0] px-3 py-1 text-sm text-[#8a7a56]"
              >
                {f.member.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 활성 시즌 없음 경고 */}
      {!activeSeason && (
        <div className="mt-4 rounded-xl border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] p-4">
          <p className="text-sm text-[var(--color-warm-muted)]">
            활성 시즌이 없습니다. 순관리에서 시즌을 생성하고 활성화해주세요.
          </p>
        </div>
      )}

      {/* 등록 폼 */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 rounded-xl border border-[var(--color-warm-border)] bg-white p-6 shadow-[var(--shadow-card)] space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-text)]">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                required
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-text)]">
                전화번호
              </label>
              <input
                name="phone"
                type="tel"
                placeholder="010-0000-0000"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-text)]">
                첫 방문일 <span className="text-red-500">*</span>
              </label>
              <input
                name="first_visit"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-warm-text)]">
                담당자
              </label>
              <select
                name="assigned_to"
                className={INPUT_CLASS}
              >
                <option value="">선택 안 함</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333] disabled:opacity-50"
            >
              {loading ? "등록 중..." : "등록"}
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

      {/* 새가족 목록 */}
      {families.length === 0 ? (
        <EmptyState message="등록된 새가족이 없습니다." />
      ) : (
        <div className="mt-6 space-y-3">
          {families
            .filter((f) => stepFilter === null || f.step === stepFilter)
            .map((family) => (
            <div
              key={family.id}
              className="hover-lift rounded-xl border border-[var(--color-warm-border)] bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-card-hover)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--color-warm-text)]">
                      {family.member.name}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        family.step === 3
                          ? "bg-[#edf5ed] text-[#3d6b3d]"
                          : STEPS[family.step - 1].color
                      }`}
                    >
                      {family.step === 3
                        ? "등록 완료"
                        : STEPS[family.step - 1].label}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-3 text-sm text-[var(--color-warm-muted)]">
                    <span>첫 방문: {family.first_visit}</span>
                    {family.member.phone && (
                      <span>{family.member.phone}</span>
                    )}
                    {family.assignee && (
                      <span>담당: {family.assignee.name}</span>
                    )}
                  </div>
                </div>
                {role === "admin" && (
                  <button
                    onClick={() =>
                      handleDelete(family.id, family.member.name)
                    }
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    삭제
                  </button>
                )}
              </div>

              {/* 단계 버튼 */}
              {role !== "group_leader" && (
                <div className="mt-3 flex gap-1.5">
                  {STEPS.map((s) => (
                    <button
                      key={s.step}
                      onClick={() => handleStepChange(family.id, s.step)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        family.step >= s.step
                          ? s.color
                          : "bg-[var(--color-warm-bg)] text-[var(--color-warm-subtle)] hover:bg-[var(--color-warm-border-light)]"
                      }`}
                    >
                      {s.step}. {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
