"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useRef, useEffect } from "react";
import type { MemberWithGroup, MinistryTeam, MemberStatus } from "@/types/member";
import {
  STATUS_COLORS,
  MINISTRY_TEAM_COLORS,
  MAIN_STATUS_OPTIONS,
  COMMON_SCHOOLS,
  getMainStatus,
  getSubStatus,
} from "@/types/member";
import { deleteMembers, moveMembersToGroup, quickUpdateField, updateMemberMinistryTeams } from "./actions";
import FilterPill from "@/components/ui/FilterPill";
import EmptyState from "@/components/ui/EmptyState";

type FilterOptions = {
  groups: { id: number; name: string; upper_room_name: string }[];
  schoolOptions: string[];
  birthYears: string[];
  ministryTeams: MinistryTeam[];
};

type EditingCellValue = {
  memberId: number;
  field: "gender" | "status" | "school_or_work" | "group";
};

type EditingCell = EditingCellValue | null;

export default function MemberList({
  members,
  currentSearch,
  currentStatus,
  currentGroup,
  currentSchool,
  currentBirthYear,
  currentMinistryTeam,
  filterOptions,
  role,
}: {
  members: MemberWithGroup[];
  currentSearch?: string;
  currentStatus?: string;
  currentGroup?: string;
  currentSchool?: string;
  currentBirthYear?: string;
  currentMinistryTeam?: string;
  filterOptions: FilterOptions;
  role: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch || "");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editingMinistryTeam, setEditingMinistryTeam] = useState<number | null>(null);
  const [schoolCustomMode, setSchoolCustomMode] = useState(false);
  const [schoolCustomValue, setSchoolCustomValue] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const isAdmin = role === "admin";
  const canEdit = role !== "group_leader";

  // --- 정렬 ---
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedMembers = [...members].sort((a, b) => {
    if (!sortKey) return 0;
    const dir = sortDir === "asc" ? 1 : -1;

    const getValue = (m: MemberWithGroup): string => {
      switch (sortKey) {
        case "name": return m.name;
        case "phone": return m.phone || "";
        case "gender": return m.gender || "";
        case "group": return m.group_info?.group_name || "";
        case "school": return m.school_or_work || "";
        case "ministry": return (m.ministry_teams ?? []).map((t) => t.name).join(",");
        case "birth_year": return m.birth_date?.substring(0, 4) || "";
        case "status": return m.status;
        default: return "";
      }
    };

    const aVal = getValue(a);
    const bVal = getValue(b);
    if (aVal === bVal) return 0;
    if (aVal === "") return 1; // 빈 값은 뒤로
    if (bVal === "") return -1;
    return aVal.localeCompare(bVal, "ko") * dir;
  });

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

  const handleMoveToGroup = (groupId: string) => {
    if (selected.size === 0 || groupId === "") return;
    const targetId = groupId === "none" ? null : Number(groupId);
    const label = targetId === null
      ? "순 배정 해제"
      : (() => {
        const g = filterOptions.groups.find((g) => g.id === targetId);
        const displayName = g ? (g.upper_room_name ? `${g.upper_room_name} > ${g.name}` : g.name) : "";
        return `${displayName}(으)로 이동`;
      })();
    if (!confirm(`선택한 ${selected.size}명을 ${label}하시겠습니까?`)) return;
    startTransition(async () => {
      const result = await moveMembersToGroup([...selected], targetId);
      if (result.success) {
        setSelected(new Set());
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  // --- 인라인 편집 ---
  const handleCellClick = (
    e: React.MouseEvent,
    memberId: number,
    field: EditingCellValue["field"],
    currentValue: string | null
  ) => {
    if (!canEdit) return;
    e.stopPropagation();
    setEditingCell({ memberId, field: field as "gender" | "status" | "school_or_work" | "group" });
    setSchoolCustomMode(false);
    setSchoolCustomValue(currentValue || "");
  };

  const handleFieldSave = async (
    memberId: number,
    field: "gender" | "status" | "school_or_work",
    value: string | null
  ) => {
    setEditingCell(null);
    const result = await quickUpdateField(memberId, field, value);
    if (!result.success) alert(result.error);
    router.refresh();
  };

  const handleGroupSave = async (memberId: number, groupId: string) => {
    setEditingCell(null);
    const targetId = groupId === "none" ? null : Number(groupId);
    const result = await moveMembersToGroup([memberId], targetId);
    if (!result.success) alert(result.error);
    router.refresh();
  };

  const handleMinistryTeamSave = async (memberId: number, teamIds: number[]) => {
    setEditingMinistryTeam(null);
    const result = await updateMemberMinistryTeams(memberId, teamIds);
    if (!result.success) alert(result.error);
    router.refresh();
  };

  // --- 필터 ---
  const buildParams = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const values: Record<string, string | undefined> = {
      search: search || undefined,
      status: currentStatus,
      group: currentGroup,
      school: currentSchool,
      birth_year: currentBirthYear,
      ministry_team: currentMinistryTeam,
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

  const handleMinistryTeamFilter = (teamId: string) => {
    router.push(`/members?${buildParams({ ministry_team: teamId }).toString()}`);
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

        <div className="flex flex-wrap gap-1">
          {[
            { value: "all", label: "전체" },
            { value: "active", label: "재적" },
            { value: "new_family", label: "새가족" },
            { value: "adjusting", label: "적응중" },
            { value: "on_leave", label: "휴적" },
            { value: "removed", label: "제적" },
          ].map((option) => (
            <FilterPill
              key={option.value}
              label={option.label}
              active={(currentStatus || "all") === option.value}
              onClick={() => handleStatusFilter(option.value)}
            />
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
          <option value="all">순 전체</option>
          {filterOptions.groups.map((g) => (
            <option key={g.id} value={String(g.id)}>
              {g.upper_room_name ? `${g.upper_room_name} > ${g.name}` : g.name}
            </option>
          ))}
        </select>

        <select
          value={currentSchool || "all"}
          onChange={(e) => handleSchoolFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="all">학교/직장 전체</option>
          {COMMON_SCHOOLS.map((s) => (
            <option key={s} value={s}>{s}</option>
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

        {filterOptions.ministryTeams.length > 0 && (
          <select
            value={currentMinistryTeam || "all"}
            onChange={(e) => handleMinistryTeamFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">사역팀 전체</option>
            <optgroup label="예배사역">
              {filterOptions.ministryTeams
                .filter((t) => t.category === "worship")
                .map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
            </optgroup>
            <optgroup label="순사역">
              {filterOptions.ministryTeams
                .filter((t) => t.category === "discipleship")
                .map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
            </optgroup>
          </select>
        )}
      </div>

      {/* 결과 수 + 선택 액션 */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          총 {members.length}명
          {canEdit && selected.size > 0 && (
            <span className="ml-2 text-blue-600">({selected.size}명 선택)</span>
          )}
        </p>
        {canEdit && selected.size > 0 && (
          <div className="flex items-center gap-2">
            {filterOptions.groups.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => {
                  handleMoveToGroup(e.target.value);
                  e.target.value = "";
                }}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              >
                <option value="" disabled>순 이동</option>
                <option value="none">배정 해제</option>
                {filterOptions.groups.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.upper_room_name ? `${g.upper_room_name} > ${g.name}` : g.name}
                  </option>
                ))}
              </select>
            )}
            {isAdmin && (
              <button
                onClick={handleDeleteSelected}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "처리 중..." : `선택 삭제 (${selected.size})`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 멤버 테이블 */}
      {members.length === 0 ? (
        <EmptyState
          message={currentSearch || currentStatus ? "검색 결과가 없습니다." : "등록된 멤버가 없습니다."}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                {canEdit && (
                  <th className="pb-3 pr-2 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={members.length > 0 && selected.size === members.length}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                  </th>
                )}
                <SortableHeader label="이름" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="전화번호" sortKey="phone" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="성별" sortKey="gender" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                <SortableHeader label="순" sortKey="group" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                <SortableHeader label="학교" sortKey="school" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                <SortableHeader label="사역팀" sortKey="ministry" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                <SortableHeader label="생년" sortKey="birth_year" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                <SortableHeader label="상태" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((member) => {
                const main = getMainStatus(member.status);
                const sub = getSubStatus(member.status);
                return (
                <tr
                  key={member.id}
                  onClick={() => router.push(`/members/${member.id}`)}
                  className="cursor-pointer border-b transition-colors hover:bg-gray-50"
                >
                  {canEdit && (
                    <td className="py-3 pr-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(member.id)}
                        onChange={() => toggleSelect(member.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                    </td>
                  )}
                  <td className="py-3 pr-4">
                    <span
                      className={`font-medium ${
                        member.gender === "M"
                          ? "text-blue-700"
                          : member.gender === "F"
                            ? "text-rose-600"
                            : "text-gray-900"
                      }`}
                    >
                      {member.name}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {member.phone || "—"}
                  </td>

                  {/* 성별 (인라인 편집) */}
                  <td
                    className="hidden py-3 pr-4 text-gray-600 sm:table-cell"
                    onClick={(e) => handleCellClick(e, member.id, "gender", member.gender)}
                  >
                    {editingCell?.memberId === member.id && editingCell.field === "gender" ? (
                      <select
                        autoFocus
                        defaultValue={member.gender || ""}
                        onChange={(e) => handleFieldSave(member.id, "gender", e.target.value || null)}
                        onBlur={() => setEditingCell(null)}
                        className="rounded border border-blue-300 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-</option>
                        <option value="M">남</option>
                        <option value="F">여</option>
                      </select>
                    ) : (
                      <span className={canEdit ? "cursor-pointer hover:text-blue-600" : ""}>
                        {member.gender === "M" ? "남" : member.gender === "F" ? "여" : "—"}
                      </span>
                    )}
                  </td>

                  {/* 순 (인라인 편집) */}
                  <td
                    className="hidden py-3 pr-4 text-gray-600 md:table-cell"
                    onClick={(e) => handleCellClick(e, member.id, "group", member.group_info?.group_name || null)}
                  >
                    {editingCell?.memberId === member.id && editingCell.field === "group" ? (
                      <select
                        autoFocus
                        defaultValue={member.group_info ? String(member.group_info.group_id) : "none"}
                        onChange={(e) => handleGroupSave(member.id, e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        className="rounded border border-blue-300 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="none">배정 해제</option>
                        {filterOptions.groups.map((g) => (
                          <option key={g.id} value={String(g.id)}>
                            {g.upper_room_name ? `${g.upper_room_name} > ${g.name}` : g.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={canEdit ? "cursor-pointer hover:text-blue-600" : ""}>
                        {member.group_info
                          ? `${member.group_info.upper_room_name} > ${member.group_info.group_name}`
                          : "—"}
                      </span>
                    )}
                  </td>

                  {/* 학교/직장 (인라인 편집) */}
                  <td
                    className="hidden py-3 pr-4 text-gray-600 md:table-cell"
                    onClick={(e) => handleCellClick(e, member.id, "school_or_work", member.school_or_work)}
                  >
                    {editingCell?.memberId === member.id && editingCell.field === "school_or_work" ? (
                      schoolCustomMode ? (
                        <input
                          autoFocus
                          type="text"
                          value={schoolCustomValue}
                          onChange={(e) => setSchoolCustomValue(e.target.value)}
                          onBlur={() => handleFieldSave(member.id, "school_or_work", schoolCustomValue || null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleFieldSave(member.id, "school_or_work", schoolCustomValue || null);
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          className="w-full min-w-[100px] rounded border border-blue-300 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="직접 입력"
                        />
                      ) : (
                        <select
                          autoFocus
                          defaultValue={member.school_or_work || ""}
                          onChange={(e) => {
                            if (e.target.value === "__custom__") {
                              setSchoolCustomMode(true);
                              setSchoolCustomValue(member.school_or_work || "");
                            } else {
                              handleFieldSave(member.id, "school_or_work", e.target.value || null);
                            }
                          }}
                          onBlur={() => setEditingCell(null)}
                          className="rounded border border-blue-300 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">-</option>
                          {COMMON_SCHOOLS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                          <option value="__custom__">직접 입력...</option>
                        </select>
                      )
                    ) : (
                      <span className={canEdit ? "cursor-pointer hover:text-blue-600" : ""}>
                        {member.school_or_work || "—"}
                      </span>
                    )}
                  </td>

                  {/* 사역팀 */}
                  <td
                    className="hidden py-3 pr-4 lg:table-cell relative"
                    onClick={(e) => {
                      if (!canEdit) return;
                      e.stopPropagation();
                      setEditingMinistryTeam(editingMinistryTeam === member.id ? null : member.id);
                    }}
                  >
                    <div className="flex flex-wrap gap-1">
                      {(member.ministry_teams ?? []).length > 0 ? (
                        (member.ministry_teams ?? []).map((t) => (
                          <span
                            key={t.id}
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${MINISTRY_TEAM_COLORS[t.category]}`}
                          >
                            {t.name}
                          </span>
                        ))
                      ) : (
                        <span className={`text-gray-400 ${canEdit ? "cursor-pointer hover:text-blue-600" : ""}`}>
                          —
                        </span>
                      )}
                    </div>
                    {editingMinistryTeam === member.id && (
                      <MinistryTeamEditor
                        memberId={member.id}
                        currentTeamIds={(member.ministry_teams ?? []).map((t) => t.id)}
                        allTeams={filterOptions.ministryTeams}
                        onSave={handleMinistryTeamSave}
                        onCancel={() => setEditingMinistryTeam(null)}
                      />
                    )}
                  </td>

                  {/* 생년 */}
                  <td className="hidden py-3 pr-4 text-gray-600 lg:table-cell">
                    {member.birth_date ? member.birth_date.substring(0, 4) : "—"}
                  </td>

                  {/* 상태 (메인 + 보조) 인라인 편집 */}
                  <td
                    className="py-3 pr-4"
                    onClick={(e) => handleCellClick(e, member.id, "status", member.status)}
                  >
                    {editingCell?.memberId === member.id && editingCell.field === "status" ? (
                      <select
                        autoFocus
                        defaultValue={
                          // adjusting → "active" 기본 선택 (재적)
                          member.status === "adjusting" || member.status === "attending" || member.status === "inactive"
                            ? "active"
                            : member.status
                        }
                        onChange={(e) => handleFieldSave(member.id, "status", e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        className="rounded border border-blue-300 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {MAIN_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <div className={`flex flex-wrap gap-1 ${canEdit ? "cursor-pointer" : ""}`}>
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${main.color}`}
                        >
                          {main.label}
                        </span>
                        {sub && (
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${sub.color}`}
                          >
                            {sub.label}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- 사역팀 멀티셀렉트 에디터 ---
function MinistryTeamEditor({
  memberId,
  currentTeamIds,
  allTeams,
  onSave,
  onCancel,
}: {
  memberId: number;
  currentTeamIds: number[];
  allTeams: MinistryTeam[];
  onSave: (memberId: number, teamIds: number[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(currentTeamIds));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  const toggle = (teamId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const worshipTeams = allTeams.filter((t) => t.category === "worship");
  const discipleshipTeams = allTeams.filter((t) => t.category === "discipleship");

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border bg-white p-2 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1 text-xs font-semibold text-indigo-600">예배사역</div>
      {worshipTeams.map((team) => (
        <label key={team.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.has(team.id)}
            onChange={() => toggle(team.id)}
            className="rounded border-gray-300"
          />
          {team.name}
        </label>
      ))}
      <div className="mb-1 mt-2 text-xs font-semibold text-emerald-600">순사역</div>
      {discipleshipTeams.map((team) => (
        <label key={team.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.has(team.id)}
            onChange={() => toggle(team.id)}
            className="rounded border-gray-300"
          />
          {team.name}
        </label>
      ))}
      <button
        onClick={() => onSave(memberId, Array.from(selected))}
        className="mt-2 w-full rounded bg-blue-600 py-1 text-xs font-medium text-white hover:bg-blue-700"
      >
        저장
      </button>
    </div>
  );
}

// --- 정렬 가능한 테이블 헤더 ---
function SortableHeader({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: string;
  currentKey: string | null;
  dir: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
}) {
  const isActive = currentKey === sortKey;
  return (
    <th
      className={`pb-3 pr-4 font-medium select-none cursor-pointer hover:text-blue-600 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {dir === "asc" ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            )}
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        )}
      </span>
    </th>
  );
}
