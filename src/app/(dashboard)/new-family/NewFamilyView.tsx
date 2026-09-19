"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createNewFamily,
  createCourse,
  updateEducation,
  confirmRegistration,
  updateAssignee,
  restoreNewFamily,
} from "./actions";
import type {
  EducationCourse,
  EducationStatus,
  NewFamilyEntry,
  Season,
} from "@/types/new-family";
import type { ActionResult } from "@/lib/validations";
import {
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const filtered = useMemo(
    () => filterFamilies(families, filters, myMemberId),
    [families, filters, myMemberId],
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
    } catch {
      setError("저장하지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }
  const currentSeason = seasons.find((s) => s.is_active);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-[var(--color-warm-text)]">
            방문·새가족
          </h2>
          <p className="mt-2 text-sm text-[var(--color-warm-muted)]">
            방문부터 새가족순, 교육 이수, 담당자의 정식 등록 확정까지 함께
            관리합니다.
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
              className={BUTTON}
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
      <nav aria-label="빠른 명단 필터" className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((q) => (
          <button
            key={q.key}
            aria-pressed={filters.quick === q.key}
            onClick={() =>
              setFilters((old) => ({ ...old, quick: q.key, registration: "" }))
            }
            className={`rounded-xl border px-4 py-3 text-sm ${filters.quick === q.key ? "border-stone-800 bg-stone-800 text-white" : "bg-white text-stone-600"}`}
          >
            {q.label}{" "}
            <span className="ml-2 font-semibold">
              {
                filterFamilies(
                  families,
                  { ...filters, quick: q.key, registration: "" },
                  myMemberId,
                ).length
              }
            </span>
          </button>
        ))}
      </nav>
      <section
        aria-label="상세 필터"
        className="rounded-xl border border-stone-200 bg-white p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-stone-600">
            이름·연락처 검색
            <input
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder="이름 또는 연락처"
              className={INPUT_CLASS}
            />
          </label>
          <label className="text-xs text-stone-600">
            방문 학기
            <select
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
        <div className="mt-4 flex justify-between text-sm">
          <span aria-live="polite">검색 결과 {filtered.length}명</span>
          <button
            onClick={() => setFilters({ ...DEFAULT_FILTERS })}
            className="underline"
          >
            필터 초기화
          </button>
        </div>
        {filters.from && filters.to && filters.from > filters.to && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            종료일은 시작일 이후로 선택해주세요.
          </p>
        )}
      </section>
      {courses.length === 0 && (
        <p className="text-sm text-stone-500">
          개설된 교육이 없습니다. 교육을 개설하면 차수별로 참여·이수를 관리할 수
          있습니다.
        </p>
      )}
      <section aria-label="새가족순 명단" className="space-y-3">
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
              className="rounded-xl border border-stone-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/members/${f.member.id}`}
                      aria-label={`${name} 상세 보기`}
                      className="text-lg font-semibold hover:underline"
                    >
                      {name} →
                    </Link>
                    <span className="rounded-full bg-stone-100 px-2 py-1 text-xs">
                      {f.member.status === "visitor" ? "방문" : "새가족 기록"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${registration === "pending" ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}
                    >
                      {REGISTRATION_LABELS[registration]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-stone-500">
                    첫 방문 {f.first_visit} · 교육{" "}
                    {EDUCATION_LABELS[educationState(f)]}
                  </p>
                  {f.member.phone && (
                    <a
                      className="mt-1 inline-block text-sm text-stone-600"
                      href={`tel:${f.member.phone}`}
                    >
                      {f.member.phone}
                    </a>
                  )}
                  {f.registered_at && (
                    <p className="mt-2 text-xs text-stone-500">
                      등록 확정{" "}
                      {new Date(f.registered_at).toLocaleDateString("ko-KR")}
                      {f.registration_source === "legacy"
                        ? " · 기존 처리 기록"
                        : " · 담당자 확인 완료"}
                    </p>
                  )}
                </div>
                {canEdit && !f.dropped_out && registration === "pending" && (
                  <button
                    disabled={
                      busy || ["removed", "on_leave"].includes(f.member.status)
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
              <div className="mt-4 border-t border-stone-100 pt-3">
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
                            updateAssignee(f.id, value ? Number(value) : null),
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
                {canEdit && !f.dropped_out && registration !== "registered" && (
                  <form
                    className="mt-3 flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      void run(
                        () =>
                          updateEducation(
                            f.id,
                            Number(data.get("course")),
                            data.get("status") as EducationStatus,
                          ),
                        "교육 기록을 저장했습니다. 정식 등록은 별도로 확정해주세요.",
                      );
                    }}
                  >
                    <label className="text-xs text-stone-600">
                      교육 차수
                      <select
                        aria-label={`${name} 교육 차수`}
                        name="course"
                        required
                        defaultValue=""
                        className={INPUT_CLASS}
                      >
                        <option value="" disabled>
                          교육 선택
                        </option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.starts_on})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-stone-600">
                      참여 상태
                      <select
                        aria-label={`${name} 참여 상태`}
                        name="status"
                        className={INPUT_CLASS}
                      >
                        <option value="scheduled">참여 예정</option>
                        <option value="in_progress">참여 중</option>
                        <option value="completed">이수</option>
                      </select>
                    </label>
                    <button
                      disabled={busy || courses.length === 0}
                      className={BUTTON}
                    >
                      교육 기록 저장
                    </button>
                  </form>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
