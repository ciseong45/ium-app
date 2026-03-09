"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useRef, useEffect } from "react";
import type { MemberWithGroup, MinistryTeam } from "@/types/member";
import { STATUS_LABELS, STATUS_COLORS, MINISTRY_TEAM_COLORS } from "@/types/member";
import { deleteMembers, moveMembersToGroup, quickUpdateField, updateMemberMinistryTeams } from "./actions";

type FilterOptions = {
  groups: { id: number; name: string }[];
  schoolOptions: string[];
  birthYears: string[];
  ministryTeams: MinistryTeam[];
};

type EditingCell = {
  memberId: number;
  field: "gender" | "status" | "school_or_work";
} | null;

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
  const isAdmin = role === "admin";
  const canEdit = role !== "viewer";

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
      ? "소그룹 배정 해제"
      : `${filterOptions.groups.find((g) => g.id === targetId)?.name}(으)로 이동`;
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
    field: "gender" | "status" | "school_or_work",
    currentValue: string | null
  ) => {
    if (!canEdit) return;
    e.stopPropagation();
    setEditingCell({ memberId, field });
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
            { value: "attending", label: "출석" },
            { value: "new_family", label: "새가족" },
            { value: "adjusting", label: "적응중" },
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
                <option value="" disabled>소그룹 이동</option>
                <option value="none">배정 해제</option>
                {filterOptions.groups.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.name}
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
                <th className="pb-3 pr-4 font-medium">이름</th>
                <th className="pb-3 pr-4 font-medium">전화번호</th>
                <th className="hidden pb-3 pr-4 font-medium sm:table-cell">성별</th>
                <th className="hidden pb-3 pr-4 font-medium md:table-cell">소그룹</th>
                <th className="hidden pb-3 pr-4 font-medium md:table-cell">학교/직장</th>
                <th className="hidden pb-3 pr-4 font-medium lg:table-cell">사역팀</th>
                <th className="hidden pb-3 pr-4 font-medium lg:table-cell">생년</th>
                <th className="pb-3 pr-4 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => router.push(`/members/${member.id}`)}
                  className={`cursor-pointer border-b transition-colors ${
                    member.gender === "M"
                      ? "bg-blue-50/50 hover:bg-blue-100/60"
                      : member.gender === "F"
                        ? "bg-rose-50/50 hover:bg-rose-100/60"
                        : "hover:bg-gray-50"
                  }`}
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
                  <td className="py-3 pr-4 font-medium text-gray-900">
                    {member.name}
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

                  {/* 소그룹 */}
                  <td className="hidden py-3 pr-4 text-gray-600 md:table-cell">
                    {member.group_info ? member.group_info.group_name : "—"}
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
                          className="w-full min-w-[120px] rounded border border-blue-300 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="학교/직장 입력"
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
                          {filterOptions.schoolOptions.map((s) => (
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

                  {/* 상태 (인라인 편집) */}
                  <td
                    className="py-3 pr-4"
                    onClick={(e) => handleCellClick(e, member.id, "status", member.status)}
                  >
                    {editingCell?.memberId === member.id && editingCell.field === "status" ? (
                      <select
                        autoFocus
                        defaultValue={member.status}
                        onChange={(e) => handleFieldSave(member.id, "status", e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        className="rounded border border-blue-300 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[member.status]} ${canEdit ? "cursor-pointer" : ""}`}
                      >
                        {STATUS_LABELS[member.status]}
                      </span>
                    )}
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
