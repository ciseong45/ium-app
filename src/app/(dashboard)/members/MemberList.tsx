"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MemberWithGroup } from "@/types/member";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/member";
import { deleteMembers } from "./actions";

type FilterOptions = {
  groups: { id: number; name: string }[];
  schoolOptions: string[];
  birthYears: string[];
};

export default function MemberList({
  members,
  currentSearch,
  currentStatus,
  currentGroup,
  currentSchool,
  currentBirthYear,
  filterOptions,
  role,
}: {
  members: MemberWithGroup[];
  currentSearch?: string;
  currentStatus?: string;
  currentGroup?: string;
  currentSchool?: string;
  currentBirthYear?: string;
  filterOptions: FilterOptions;
  role: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch || "");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const isAdmin = role === "admin";

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === members.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(members.map((m) => m.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}명의 멤버를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    startTransition(async () => {
      const result = await deleteMembers([...selected]);
      if (result.success) {
        setSelected(new Set());
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  const buildParams = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const values: Record<string, string | undefined> = {
      search: search || undefined,
      status: currentStatus,
      group: currentGroup,
      school: currentSchool,
      birth_year: currentBirthYear,
      ...overrides,
    };
    Object.entries(values).forEach(([key, val]) => {
      if (val && val !== "all") params.set(key, val);
    });
    return params;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/members?${buildParams({ search: search || undefined }).toString()}`);
  };

  const handleStatusFilter = (status: string) => {
    router.push(`/members?${buildParams({ status }).toString()}`);
  };

  const handleGroupFilter = (group: string) => {
    router.push(`/members?${buildParams({ group }).toString()}`);
  };

  const handleSchoolFilter = (school: string) => {
    router.push(`/members?${buildParams({ school }).toString()}`);
  };

  const handleBirthYearFilter = (birthYear: string) => {
    router.push(`/members?${buildParams({ birth_year: birthYear }).toString()}`);
  };

  return (
    <div className="mt-6">
      {/* 검색 + 상태 필터 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호로 검색"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            검색
          </button>
        </form>

        <div className="flex gap-1">
          {[
            { value: "all", label: "전체" },
            { value: "active", label: "재적" },
            { value: "attending", label: "출석" },
            { value: "on_leave", label: "휴적" },
            { value: "inactive", label: "미출석" },
            { value: "removed", label: "제적" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusFilter(option.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                (currentStatus || "all") === option.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 추가 필터 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={currentGroup || "all"}
          onChange={(e) => handleGroupFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="all">소그룹 전체</option>
          {filterOptions.groups.map((g) => (
            <option key={g.id} value={String(g.id)}>
              {g.name}
            </option>
          ))}
        </select>

        <select
          value={currentSchool || "all"}
          onChange={(e) => handleSchoolFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="all">학교/직장 전체</option>
          {filterOptions.schoolOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={currentBirthYear || "all"}
          onChange={(e) => handleBirthYearFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="all">생년 전체</option>
          {filterOptions.birthYears.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>

      {/* 결과 수 + 선택 삭제 */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          총 {members.length}명
          {isAdmin && selected.size > 0 && (
            <span className="ml-2 text-blue-600">({selected.size}명 선택)</span>
          )}
        </p>
        {isAdmin && selected.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "삭제 중..." : `선택 삭제 (${selected.size})`}
          </button>
        )}
      </div>

      {/* 멤버 테이블 */}
      {members.length === 0 ? (
        <div className="mt-8 text-center text-gray-400">
          {currentSearch || currentStatus
            ? "검색 결과가 없습니다."
            : "등록된 멤버가 없습니다."}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                {isAdmin && (
                  <th className="pb-3 pr-2 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={members.length > 0 && selected.size === members.length}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                  </th>
                )}
                <th className="pb-3 pr-4 font-medium">이름</th>
                <th className="pb-3 pr-4 font-medium">전화번호</th>
                <th className="hidden pb-3 pr-4 font-medium md:table-cell">
                  소그룹
                </th>
                <th className="hidden pb-3 pr-4 font-medium sm:table-cell">
                  성별
                </th>
                <th className="pb-3 pr-4 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => router.push(`/members/${member.id}`)}
                  className="cursor-pointer border-b transition-colors hover:bg-gray-50"
                >
                  {isAdmin && (
                    <td className="py-3 pr-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(member.id)}
                        onChange={() => toggleSelect(member.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                    </td>
                  )}
                  <td className="py-3 pr-4 font-medium text-gray-900">
                    {member.name}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {member.phone || "—"}
                  </td>
                  <td className="hidden py-3 pr-4 text-gray-600 md:table-cell">
                    {member.group_info
                      ? member.group_info.group_name
                      : "—"}
                  </td>
                  <td className="hidden py-3 pr-4 text-gray-600 sm:table-cell">
                    {member.gender === "M"
                      ? "남"
                      : member.gender === "F"
                        ? "여"
                        : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[member.status]}`}
                    >
                      {STATUS_LABELS[member.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
