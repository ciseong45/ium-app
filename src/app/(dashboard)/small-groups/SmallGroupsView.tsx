"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSeason, deleteSeason } from "./actions";
import { useRole } from "@/lib/RoleContext";
import SeasonDetail from "./[seasonId]/SeasonDetail";
import EmptyState from "@/components/ui/EmptyState";
import { INPUT_CLASS } from "@/components/ui/constants";
import type { Member } from "@/types/member";
import type { UpperRoom, GroupMemberEntry } from "@/types/small-group";

type Season = {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
};

type Group = {
  id: number;
  name: string;
  season_id: number;
  upper_room_id: number;
  leader: { id: number; last_name: string; first_name: string } | null;
};

export default function SmallGroupsView({
  seasons,
  activeSeason,
  groups,
  upperRooms,
  unassignedMembers,
  initialGroupMembers,
}: {
  seasons: Season[];
  activeSeason: Season | null;
  groups: Group[];
  upperRooms: UpperRoom[];
  unassignedMembers: Member[];
  initialGroupMembers: Record<number, GroupMemberEntry[]>;
}) {
  const router = useRouter();
  const role = useRole();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const inactiveSeasons = seasons.filter((s) => !s.is_active);

  const handleSeasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "active") {
      router.push("/small-groups");
    } else {
      router.push(`/small-groups/${value}`);
    }
  };

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

  const handleDelete = async () => {
    if (!activeSeason) return;
    if (!confirm(`"${activeSeason.name}" 시즌을 삭제하시겠습니까? 소속 순도 모두 삭제됩니다.`)) return;
    try {
      await deleteSeason(activeSeason.id);
      router.refresh();
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  return (
    <div className="animate-fade-in">
      {/* 상단: 제목 + 시즌 전환 + 액션 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* 시즌 전환 드롭다운 */}
          {seasons.length > 0 ? (
            <select
              value="active"
              onChange={handleSeasonChange}
              className="rounded-lg border border-[var(--color-warm-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-warm-text)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/10"
            >
              {activeSeason && (
                <optgroup label="활성 시즌">
                  <option value="active">
                    {activeSeason.name}
                  </option>
                </optgroup>
              )}
              {inactiveSeasons.length > 0 && (
                <optgroup label="이전 시즌">
                  {inactiveSeasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          ) : (
            <p className="text-sm text-[var(--color-warm-muted)]">등록된 시즌이 없습니다</p>
          )}
        </div>

        {/* 어드민 액션 */}
        {role === "admin" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333]"
            >
              + 새 시즌
            </button>
            {activeSeason && (
              <button
                onClick={handleDelete}
                className="text-[12px] text-[var(--color-warm-muted)] transition-all duration-300 hover:text-rose-500"
              >
                삭제
              </button>
            )}
          </div>
        )}
      </div>

      {/* 시즌 생성 폼 */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-5 rounded-xl border border-[var(--color-warm-border)] bg-white p-6 shadow-[var(--shadow-card)] space-y-3"
        >
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-warm-muted)]">
              시즌 이름 <span className="text-rose-400">*</span>
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
              <label className="block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-warm-muted)]">
                시작일
              </label>
              <input name="start_date" type="date" className={INPUT_CLASS} />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-warm-muted)]">
                종료일
              </label>
              <input name="end_date" type="date" className={INPUT_CLASS} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-warm-text)]">
            <input name="is_active" type="checkbox" defaultChecked className="accent-[#1a1a1a]" />
            현재 활성 시즌으로 설정
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333] disabled:opacity-40"
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

      {/* 메인 콘텐츠: 활성 시즌 상세 or EmptyState */}
      <div className="mt-6">
        {activeSeason ? (
          <SeasonDetail
            season={activeSeason}
            seasons={seasons}
            groups={groups}
            upperRooms={upperRooms}
            unassignedMembers={unassignedMembers}
            initialGroupMembers={initialGroupMembers}
            hideHeader
          />
        ) : (
          <EmptyState message="활성 시즌이 없습니다. 새 시즌을 만들어주세요." />
        )}
      </div>
    </div>
  );
}
