"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createNewFamily,
  createCourse,
  updateSimpleEducation,
  confirmRegistration,
  updateAssignee,
  restoreNewFamily,
} from "./actions";
import type {
  EducationCourse,
  NewFamilyEntry,
  Season,
} from "@/types/new-family";
import type { ActionResult } from "@/lib/validations";
import {
  graduationReady,
  educationProgressValue,
  progressLabel,
  DEFAULT_FILTERS,
  filterFamilies,
  educationState,
  registrationState,
  EDUCATION_LABELS,
  REGISTRATION_LABELS,
  type FamilyFilters,
} from "@/lib/new-family-workflow";
import { useRole } from "@/lib/RoleContext";
import { INPUT_CLASS } from "@/components/ui/constants";

type SimpleMember = { id: number; last_name: string; first_name: string };
const QUICK_FILTERS: { key: FamilyFilters["quick"]; label: string }[] = [
  { key: "unregistered", label: "등록 전 명단" },
  { key: "week1", label: "1주차" },
  { key: "week2", label: "2주차" },
  { key: "week3", label: "3주차" },
  { key: "graduation", label: "수료" },
  { key: "all", label: "전체" },
  { key: "uneducated", label: "교육 미이수" },
  { key: "pending", label: "등록 확정 대기" },
  { key: "registered", label: "정식 등록 완료" },
  { key: "archived", label: "보관" },
];
const BUTTON =
  "rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm text-white disabled:opacity-40";

export default function NewFamilyView({
  families,
  members,
  seasons,
  courses = [],
  currentSeasonId,
  myMemberId = null,
}: {
  families: NewFamilyEntry[];
  members: SimpleMember[];
  seasons: Season[];
  courses?: EducationCourse[];
  currentSeasonId?: number;
  myMemberId?: number | null;
}) {
  const router = useRouter();
  const canEdit = useRole() !== "group_leader";
  const [filters, setFilters] = useState<FamilyFilters>({
    ...DEFAULT_FILTERS,
    visitSeason: currentSeasonId ? String(currentSeasonId) : "",
  });
  const [panel, setPanel] = useState<"visitor" | "course" | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const advancedCount = [
    filters.visitSeason,
    filters.course,
    filters.education,
    filters.registration,
    filters.assignee,
    filters.from,
    filters.to,
    ["archived", "uneducated"].includes(filters.quick) ? filters.quick : "",
  ].filter(Boolean).length;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const filtered = useMemo(
    () => filterFamilies(families, filters, myMemberId, courses),
    [families, filters, myMemberId, courses],
  );
  const assignees = useMemo(() => {
    const all = new Map(members.map((m) => [m.id, m]));
    families.forEach((f) => {
      if (f.assignee) all.set(f.assignee.id, f.assignee);
    });
    return Array.from(all.values());
  }, [members, families]);
  const setFilter = (key: keyof FamilyFilters, value: string) =>
    setFilters((old) => ({ ...old, [key]: value }));
  async function run(action: () => Promise<ActionResult>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage(success);
      setPanel(null);
      router.refresh();
      return true;
    } catch {
      setError("저장하지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }
  const currentSeason = seasons.find((s) => s.is_active);
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-[var(--color-warm-text)]">
            방문·새가족
          </h2>
          <p className="mt-2 text-sm text-[var(--color-warm-muted)]">
            새가족순 명단과 등록 현황
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              className={BUTTON}
              onClick={() => setPanel(panel === "visitor" ? null : "visitor")}
            >
              방문 등록
            </button>
            <button
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600"
              onClick={() => setPanel(panel === "course" ? null : "course")}
            >
              교육 개설
            </button>
          </div>
        )}
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-green-50 p-3 text-sm text-green-800"
        >
          {message}
        </p>
      )}
      {panel === "visitor" && (
        <form
          className="rounded-xl border bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void run(
              () => createNewFamily(data),
              "방문자로 등록하고 새가족순에 추가했습니다.",
            );
          }}
        >
          <h3 className="mb-4 font-semibold">첫 방문 등록</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              성
              <input
                name="last_name"
                required
                maxLength={10}
                className={INPUT_CLASS}
              />
            </label>
            <label className="text-sm">
              이름
              <input
                name="first_name"
                required
                maxLength={40}
                className={INPUT_CLASS}
              />
            </label>
            <label className="text-sm">
              연락처
              <input
                name="phone"
                type="tel"
                maxLength={20}
                className={INPUT_CLASS}
              />
            </label>
            <label className="text-sm">
              첫 방문일
              <input
                name="first_visit"
                type="date"
                required
                className={INPUT_CLASS}
              />
            </label>
            <label className="text-sm">
              담당자
              <select name="assigned_to" className={INPUT_CLASS}>
                <option value="">미지정</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.last_name}
                    {m.first_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="my-3 text-sm text-stone-500">
            현재 학기의 새가족순에 소속됩니다. 정식 멤버 등록은 교육 이수 후
            담당자가 확정합니다.
          </p>
          <button className={BUTTON} disabled={busy || !currentSeason}>
            방문 등록 저장
          </button>
          {!currentSeason && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              순 관리에서 현재 학기를 먼저 설정해주세요.
            </p>
          )}
        </form>
      )}
      {panel === "course" && (
        <form
          className="rounded-xl border bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void run(
              () => createCourse(data),
              "교육을 개설했습니다. 명단에서 참여자를 지정해주세요.",
            );
          }}
        >
          <h3 className="mb-4 font-semibold">새가족교육 개설</h3>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              교육 학기
              <select
                name="season_id"
                required
                defaultValue={currentSeason?.id ?? ""}
                className={INPUT_CLASS}
              >
                <option value="">학기 선택</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              교육 이름
              <input
                name="name"
                required
                maxLength={80}
                placeholder="예: 가을학기 1차 새가족교육"
                className={INPUT_CLASS}
              />
            </label>
            <label className="text-sm">
              총 교육 주수
              <input
                name="total_weeks"
                type="number"
                min={1}
                max={52}
                defaultValue={3}
                required
                className={INPUT_CLASS}
              />
            </label>
            <label className="text-sm">
              교육 시작일
              <input
                name="starts_on"
                required
                type="date"
                className={INPUT_CLASS}
              />
            </label>
          </div>
          <button className={BUTTON} disabled={busy}>
            교육 저장
          </button>
        </form>
      )}
      <nav
        role="tablist"
        aria-label="빠른 명단 필터"
        className="flex flex-wrap gap-2"
      >
        {QUICK_FILTERS.filter(
          (q) => !["archived", "uneducated"].includes(q.key),
        ).map((q) => (
          <button
            role="tab"
            aria-selected={filters.quick === q.key}
            key={q.key}
            onClick={() =>
              setFilters((old) => ({ ...old, quick: q.key, registration: "" }))
            }
            className={`rounded-lg border px-3 py-2 text-sm ${filters.quick === q.key ? "border-stone-800 bg-stone-800 text-white" : "bg-white text-stone-600"}`}
          >
            {q.label}{" "}
            <span className="ml-2 font-semibold">
              {
                filterFamilies(
                  families,
                  { ...filters, quick: q.key, registration: "" },
                  myMemberId,
                  courses,
                ).length
              }
            </span>
          </button>
        ))}
      </nav>
      {filters.quick === "graduation" && (
        <p className="text-sm text-stone-500">
          3주차에 도달한 분과 수료한 분의 명단입니다. 수료 후 정식 등록은
          관리에서 확정해주세요.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">이름·연락처 검색</span>
          <input
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            placeholder="이름·연락처 검색"
            className={INPUT_CLASS}
          />
        </label>
        <button
          aria-expanded={showFilters}
          aria-controls="family-filters"
          onClick={() => setShowFilters(!showFilters)}
          className={`rounded-lg border px-3 py-2.5 text-sm ${advancedCount ? "border-stone-700 text-stone-900" : "border-stone-200 text-stone-600"}`}
        >
          상세 필터{advancedCount > 0 ? ` ${advancedCount}` : ""}
        </button>
      </div>
      {showFilters && (
        <section
          id="family-filters"
          aria-label="상세 필터"
          className="rounded-xl border border-stone-200 bg-white p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-stone-600">
              명단 범위
              <select
                aria-label="명단 범위"
                value={filters.quick}
                onChange={(e) => setFilter("quick", e.target.value)}
                className={INPUT_CLASS}
              >
                {QUICK_FILTERS.map((q) => (
                  <option key={q.key} value={q.key}>
                    {q.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-stone-600">
              방문 학기
              <select
                aria-label="방문 학기"
                value={filters.visitSeason}
                onChange={(e) => setFilter("visitSeason", e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">전체 학기</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.is_active ? " (현재)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-stone-600">
              교육 차수
              <select
                aria-label="교육 차수"
                value={filters.course}
                onChange={(e) => setFilter("course", e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">전체 교육</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {seasons.find((s) => s.id === c.season_id)?.name} · {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-stone-600">
              교육 상태
              <select
                aria-label="교육 상태"
                value={filters.education}
                onChange={(e) => setFilter("education", e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">전체 상태</option>
                {Object.entries(EDUCATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-stone-600">
              등록 상태
              <select
                aria-label="등록 상태"
                value={filters.registration}
                onChange={(e) =>
                  setFilters((old) => ({
                    ...old,
                    registration: e.target.value,
                    quick: old.quick === "archived" ? "archived" : "all",
                  }))
                }
                className={INPUT_CLASS}
              >
                <option value="">전체 상태</option>
                {Object.entries(REGISTRATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-stone-600">
              담당자
              <select
                aria-label="담당자"
                value={filters.assignee}
                onChange={(e) => setFilter("assignee", e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">전체 담당자</option>
                <option value="mine" disabled={!myMemberId}>
                  내 담당{!myMemberId ? " (계정 연결 필요)" : ""}
                </option>
                <option value="unassigned">미지정</option>
                {assignees.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.last_name}
                    {m.first_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-stone-600">
              방문 시작일
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilter("from", e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="text-xs text-stone-600">
              방문 종료일
              <input
                type="date"
                min={filters.from}
                value={filters.to}
                onChange={(e) => setFilter("to", e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
          </div>
          {filters.from && filters.to && filters.from > filters.to && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              종료일은 시작일 이후로 선택해주세요.
            </p>
          )}
        </section>
      )}
      <div className="flex justify-between text-sm">
        <span aria-live="polite">검색 결과 {filtered.length}명</span>
        <button
          onClick={() => setFilters({ ...DEFAULT_FILTERS })}
          className="text-stone-500 underline"
        >
          필터 초기화
        </button>
      </div>
      <section
        aria-label="새가족순 명단"
        className="overflow-hidden rounded-xl border border-stone-200 bg-white"
      >
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem_6rem_4rem] gap-4 border-b bg-stone-50 px-4 py-2.5 text-xs text-stone-500 md:grid"
        >
          <span>이름</span>
          <span>진행 상태</span>
          <span>첫 방문</span>
          <span>담당자</span>
          <span>관리</span>
        </div>
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-stone-500">
            조건에 맞는 명단이 없습니다. 필터를 변경해보세요.
          </div>
        )}
        {filtered.map((f) => {
          const name = `${f.member.last_name}${f.member.first_name}`;
          const registration = registrationState(f);
          return (
            <article
              key={f.id}
              className="border-b border-stone-100 last:border-b-0"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem_6rem_4rem]">
                <Link
                  href={`/members/${f.member.id}`}
                  aria-label={`${name} 상세 보기`}
                  className="min-w-0 break-words font-medium text-stone-900 hover:underline"
                >
                  {name}
                </Link>
                <div className="row-start-2 flex flex-wrap items-center gap-2 md:row-auto">
                  {canEdit &&
                  !f.dropped_out &&
                  registration !== "registered" ? (
                    <select
                      aria-label={`${name} 진행 상태`}
                      value={educationProgressValue(f)}
                      disabled={busy}
                      className={`cursor-pointer rounded-full border-0 px-2 py-1 text-xs disabled:opacity-50 ${educationState(f) === "completed" ? "bg-green-50 text-green-800" : "bg-stone-100 text-stone-700"}`}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        void run(
                          () => updateSimpleEducation(f.id, value),
                          value === 4
                            ? "수료 처리했습니다. 정식 등록은 별도로 확정해주세요."
                            : value === 0
                              ? "교육 미참여로 변경했습니다."
                              : `${value}주차로 변경했습니다.`,
                        );
                      }}
                    >
                      {educationProgressValue(f) === "" && (
                        <option value="" disabled>
                          {progressLabel(f)}
                        </option>
                      )}
                      <option value="0">교육 미참여</option>
                      <option value="1">1주차</option>
                      <option value="2">2주차</option>
                      <option value="3">3주차</option>
                      <option value="4">수료</option>
                    </select>
                  ) : (
                    <span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">
                      {progressLabel(f)}
                    </span>
                  )}
                  {filters.quick === "graduation" &&
                    graduationReady(f, courses) &&
                    canEdit && (
                      <button
                        aria-label={`${name} 수료 처리`}
                        disabled={busy}
                        className="rounded-lg border px-2 py-1 text-xs"
                        onClick={() =>
                          void run(
                            () => updateSimpleEducation(f.id, 4),
                            "수료 처리했습니다. 정식 등록은 별도로 확정해주세요.",
                          )
                        }
                      >
                        수료 처리
                      </button>
                    )}
                  {educationState(f) === "completed" && (
                    <span className="text-xs text-stone-500">
                      {REGISTRATION_LABELS[registration]}
                    </span>
                  )}
                </div>
                <span className="hidden text-sm text-stone-500 md:block">
                  {f.first_visit}
                </span>
                <span className="hidden truncate text-sm text-stone-500 md:block">
                  {f.assignee
                    ? `${f.assignee.last_name}${f.assignee.first_name}`
                    : "미지정"}
                </span>
                <button
                  aria-label={`${name} 관리${expandedId === f.id ? " 닫기" : ""}`}
                  aria-expanded={expandedId === f.id}
                  aria-controls={`family-${f.id}-details`}
                  onClick={() =>
                    setExpandedId(expandedId === f.id ? null : f.id)
                  }
                  className="col-start-2 row-span-2 row-start-1 rounded-lg px-2 py-2 text-sm text-stone-600 hover:bg-stone-100 md:col-auto md:row-span-1 md:row-auto"
                >
                  {expandedId === f.id ? "닫기 ↑" : "관리 ↓"}
                </button>
              </div>
              {expandedId === f.id && (
                <div
                  id={`family-${f.id}-details`}
                  className="border-t border-stone-100 bg-stone-50/60 px-4 py-4"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-stone-500">
                    <span>첫 방문 {f.first_visit}</span>
                    {f.member.phone && (
                      <a href={`tel:${f.member.phone}`} className="underline">
                        {f.member.phone}
                      </a>
                    )}
                    {f.registered_at && (
                      <span>
                        등록 확정{" "}
                        {new Date(f.registered_at).toLocaleDateString("ko-KR")}
                        {f.registration_source === "legacy"
                          ? " · 기존 처리 기록"
                          : " · 담당자 확인 완료"}
                      </span>
                    )}
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {canEdit &&
                      !f.dropped_out &&
                      registration === "pending" && (
                        <button
                          disabled={
                            busy ||
                            ["removed", "on_leave"].includes(f.member.status)
                          }
                          className={BUTTON}
                          onClick={() => {
                            if (
                              confirm(
                                `${name}님의 교육 이수를 확인하고 정식 멤버 등록을 확정하시겠습니까?`,
                              )
                            )
                              void run(
                                () => confirmRegistration(f.id),
                                `${name}님의 정식 등록을 확정했습니다.`,
                              );
                          }}
                        >
                          정식 등록 확정
                        </button>
                      )}
                    {canEdit && f.dropped_out && (
                      <button
                        disabled={busy}
                        className={BUTTON}
                        onClick={() =>
                          void run(
                            () => restoreNewFamily(f.id),
                            "교육 이력을 보존하고 명단으로 복귀했습니다.",
                          )
                        }
                      >
                        명단 복귀
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="flex flex-wrap items-center gap-2 text-sm">
                      담당자
                      {canEdit ? (
                        <select
                          aria-label={`${name} 담당자`}
                          value={f.assigned_to ?? ""}
                          disabled={busy}
                          onChange={(e) => {
                            const value = e.target.value;
                            void run(
                              () =>
                                updateAssignee(
                                  f.id,
                                  value ? Number(value) : null,
                                ),
                              "담당자를 변경했습니다.",
                            );
                          }}
                          className="rounded border p-2"
                        >
                          <option value="">미지정</option>
                          {assignees.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.last_name}
                              {m.first_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>
                          {f.assignee
                            ? `${f.assignee.last_name}${f.assignee.first_name}`
                            : "미지정"}
                        </span>
                      )}
                    </label>
                    {(f.enrollments ?? []).map((e) => (
                      <p key={e.id} className="mt-2 text-sm text-stone-500">
                        {courses.find((c) => c.id === e.course_id)?.name ??
                          "교육 기록"}{" "}
                        · {EDUCATION_LABELS[e.status]}
                        {e.completed_at
                          ? ` · 이수 ${new Date(e.completed_at).toLocaleDateString("ko-KR")}`
                          : ""}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
