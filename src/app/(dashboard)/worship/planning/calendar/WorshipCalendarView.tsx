"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import Link from "next/link";
import type { WorshipLineup, WorshipConti, ServiceType } from "@/types/worship";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_COLORS } from "@/types/worship";
import {
  CARD_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_LABEL_CLASS,
  BTN_SECONDARY_CLASS,
} from "@/components/ui/constants";

type Props = {
  year: number;
  month: number;
  lineups: WorshipLineup[];
  contis: WorshipConti[];
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function WorshipCalendarView({ year, month, lineups, contis }: Props) {
  const router = useRouter();

  const lineupMap = useMemo(() => {
    const map = new Map<string, WorshipLineup>();
    lineups.forEach((l) => map.set(l.service_date, l));
    return map;
  }, [lineups]);

  const contiMap = useMemo(() => {
    const map = new Map<string, WorshipConti[]>();
    contis.forEach((c) => {
      const existing = map.get(c.service_date) || [];
      existing.push(c);
      map.set(c.service_date, existing);
    });
    return map;
  }, [contis]);

  // 달력 날짜 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startOffset = firstDay.getDay(); // 0=일요일

    const days: (number | null)[] = [];
    // 앞쪽 빈칸
    for (let i = 0; i < startOffset; i++) days.push(null);
    // 실제 날짜
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    return days;
  }, [year, month]);

  const handlePrev = () => {
    const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    router.push(`/worship/planning/calendar?year=${prev.year}&month=${prev.month}`);
  };

  const handleNext = () => {
    const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    router.push(`/worship/planning/calendar?year=${next.year}&month=${next.month}`);
  };

  const today = new Date();
  const isToday = (day: number) =>
    year === today.getFullYear() &&
    month === today.getMonth() + 1 &&
    day === today.getDate();

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className={SECTION_LABEL_CLASS}>Worship Calendar</p>
          <h1 className={PAGE_TITLE_CLASS}>예배 캘린더</h1>
        </div>
      </div>

      {/* 월 네비게이션 */}
      <div className="mb-6 flex items-center justify-between">
        <button onClick={handlePrev} className={BTN_SECONDARY_CLASS}>
          ←
        </button>
        <h2 className="text-lg font-medium text-[var(--color-warm-text)]">
          {year}년 {month}월
        </h2>
        <button onClick={handleNext} className={BTN_SECONDARY_CLASS}>
          →
        </button>
      </div>

      {/* 캘린더 그리드 */}
      <div className={`${CARD_CLASS} overflow-hidden`}>
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-[var(--color-warm-border)] bg-[var(--color-warm-bg)]">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`px-2 py-2.5 text-center text-[10px] font-medium uppercase tracking-[0.2em] ${
                i === 0
                  ? "text-rose-400"
                  : "text-[var(--color-warm-muted)]"
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="min-h-[100px] border-b border-r border-[var(--color-warm-border-light)] bg-[var(--color-warm-bg)]/30" />;
            }

            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const lineup = lineupMap.get(dateStr);
            const dayContis = contiMap.get(dateStr) || [];
            const dayOfWeek = new Date(year, month - 1, day).getDay();
            const isSunday = dayOfWeek === 0;

            return (
              <div
                key={day}
                className={`min-h-[100px] border-b border-r border-[var(--color-warm-border-light)] p-2 transition-colors hover:bg-[var(--color-warm-bg)] ${
                  isToday(day) ? "bg-[var(--color-warm-bg)]" : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`text-xs font-medium ${
                      isToday(day)
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a] text-white"
                        : isSunday
                          ? "text-rose-400"
                          : "text-[var(--color-warm-text)]"
                    }`}
                  >
                    {day}
                  </span>
                </div>

                {/* 라인업 상태 */}
                {lineup && (
                  <Link
                    href={`/worship/planning/lineup?date=${dateStr}`}
                    className="mb-0.5 block rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#edf5ed] text-[#3d6b3d] hover:opacity-80 transition-opacity"
                  >
                    라인업 ✓
                  </Link>
                )}

                {/* 콘티 상태 */}
                {dayContis.map((c) => (
                  <Link
                    key={c.id}
                    href={`/worship/planning/conti?date=${dateStr}&type=${c.service_type}`}
                    className={`mb-0.5 block rounded px-1.5 py-0.5 text-[10px] font-medium hover:opacity-80 transition-opacity ${
                      SERVICE_TYPE_COLORS[c.service_type as ServiceType]
                    }`}
                  >
                    {SERVICE_TYPE_LABELS[c.service_type as ServiceType]} ✓
                  </Link>
                ))}

                {/* 일요일인데 아무것도 없으면 */}
                {isSunday && !lineup && dayContis.length === 0 && (
                  <Link
                    href={`/worship/planning/lineup?date=${dateStr}`}
                    className="block rounded px-1.5 py-0.5 text-[10px] text-[var(--color-warm-muted)] hover:bg-[var(--color-warm-border)] transition-colors"
                  >
                    + 예배 준비
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
