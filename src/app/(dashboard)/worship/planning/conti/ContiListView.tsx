"use client";

import { useRouter } from "next/navigation";
import type { WorshipConti, ServiceType } from "@/types/worship";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_COLORS } from "@/types/worship";
import {
  CARD_HOVER_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_LABEL_CLASS,
  BTN_PRIMARY_CLASS,
} from "@/components/ui/constants";
import EmptyState from "@/components/ui/EmptyState";

type ContiWithExtra = WorshipConti & {
  leader?: { last_name: string; first_name: string } | null;
  song_count: number;
};

type Props = {
  contis: ContiWithExtra[];
};

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayName = DAY_NAMES[d.getDay()];
  return { month, day, dayName };
}

export default function ContiListView({ contis }: Props) {
  const router = useRouter();

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className={SECTION_LABEL_CLASS}>Conti</p>
          <h1 className={PAGE_TITLE_CLASS}>예배 콘티</h1>
        </div>
        <button
          onClick={() => router.push("/worship/planning/conti/edit")}
          className={BTN_PRIMARY_CLASS}
        >
          새 콘티 작성
        </button>
      </div>

      {contis.length === 0 ? (
        <EmptyState message="아직 작성된 콘티가 없습니다" />
      ) : (
        <div className="space-y-3">
          {contis.map((c) => {
            const { month, day, dayName } = formatDate(c.service_date);
            const leaderName = c.leader
              ? `${c.leader.last_name}${c.leader.first_name}`
              : null;
            const colorClass =
              SERVICE_TYPE_COLORS[c.service_type as ServiceType] ?? "";

            return (
              <div
                key={`${c.service_date}-${c.service_type}`}
                onClick={() =>
                  router.push(
                    `/worship/planning/conti/edit?date=${c.service_date}&type=${c.service_type}`
                  )
                }
                className={`${CARD_HOVER_CLASS} flex cursor-pointer items-center gap-5 px-5 py-4`}
              >
                {/* 날짜 */}
                <div className="shrink-0 text-center">
                  <p className="text-xl font-light text-[var(--color-warm-text)]">
                    {month}/{day}
                  </p>
                  <p className="text-[10px] text-[var(--color-warm-muted)]">
                    {dayName}요일
                  </p>
                </div>

                {/* 구분선 */}
                <div className="h-10 w-px bg-[var(--color-warm-border)]" />

                {/* 콘티 정보 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}
                    >
                      {SERVICE_TYPE_LABELS[c.service_type as ServiceType] ??
                        c.service_type}
                    </span>
                    {c.theme && (
                      <span className="truncate text-sm font-medium text-[var(--color-warm-text)]">
                        {c.theme}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-warm-muted)]">
                    {c.scripture && <span>{c.scripture}</span>}
                    {leaderName && <span>{leaderName}</span>}
                    {c.song_count > 0 && <span>{c.song_count}곡</span>}
                  </div>
                </div>

                {/* 화살표 */}
                <span className="shrink-0 text-[var(--color-warm-muted)]">
                  →
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
