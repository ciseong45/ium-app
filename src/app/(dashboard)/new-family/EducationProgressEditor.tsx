"use client";
import { useState } from "react";
import type { EducationCourse, NewFamilyEntry } from "@/types/new-family";
import { INPUT_CLASS } from "@/components/ui/constants";

export default function EducationProgressEditor({
  family,
  courses,
  busy,
  onSave,
  onClose,
}: {
  family: NewFamilyEntry;
  courses: EducationCourse[];
  busy: boolean;
  onSave: (course: number, week: number) => void;
  onClose?: () => void;
}) {
  const existing = [...(family.enrollments ?? [])].sort(
    (a, b) => b.id - a.id,
  )[0];
  const [courseId, setCourseId] = useState(String(existing?.course_id ?? ""));
  const [week, setWeek] = useState(existing?.current_week ?? 1);
  const total =
    courses.find((c) => String(c.id) === courseId)?.total_weeks ?? 3;
  const name = `${family.member.last_name}${family.member.first_name}`;
  return (
    <form
      aria-label={`${name} 교육 진도`}
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Number(courseId), week);
      }}
    >
      <label className="text-xs text-stone-600">
        교육 차수
        <select
          aria-label={`${name} 교육 차수`}
          required
          value={courseId}
          disabled={busy}
          className={INPUT_CLASS}
          onChange={(e) => {
            setCourseId(e.target.value);
            setWeek(
              family.enrollments?.find(
                (x) => String(x.course_id) === e.target.value,
              )?.current_week ?? 1,
            );
          }}
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
        교육 주차
        <select
          aria-label={`${name} 교육 주차`}
          value={week}
          disabled={busy || !courseId}
          className={INPUT_CLASS}
          onChange={(e) => setWeek(Number(e.target.value))}
        >
          {Array.from({ length: total }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}주차
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={busy || !courseId}
        className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        교육 기록 저장
      </button>
      {onClose && (
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="px-3 py-2 text-sm text-stone-600"
        >
          취소
        </button>
      )}
      <p className="w-full text-xs text-stone-500">
        {courses.length
          ? "마지막 주차 저장 후 수료 탭에서 수료를 확정해주세요."
          : "상단의 교육 개설에서 교육을 먼저 만들어주세요."}
      </p>
    </form>
  );
}
