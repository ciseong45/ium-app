import Link from "next/link";
import type { UserRole } from "@/lib/auth";
import type { CareDashboardData, CareDashboardItem } from "@/types/care";

const CASE_LABELS: Record<CareDashboardItem["caseType"], string> = {
  welcome: "첫 방문",
  new_family: "새가족",
  connection: "연결 확인",
  general_care: "안부 확인",
  long_absence: "장기 미출석",
};

function dueLabel(today: string, dueDate: string) {
  if (dueDate < today) return "기한 지남";
  if (dueDate === today) return "오늘";
  return new Date(`${dueDate}T12:00:00`).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export default function CareDashboardPanel({
  data,
  today,
  role,
}: {
  data: CareDashboardData;
  today: string;
  role: UserRole;
}) {
  return (
    <section aria-labelledby="care-dashboard-title">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-warm-muted)]">
        {role === "admin" ? "Team Care" : "My Care"}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="care-dashboard-title" className="font-serif text-3xl font-light text-[var(--color-warm-text)]">
            이번 주 목양
          </h2>
          <p className="mt-1 text-sm text-[var(--color-warm-muted)]">사람과 다음 약속을 먼저 확인하세요.</p>
        </div>
        <Link href="/members" className="rounded-lg border border-[var(--color-warm-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--color-warm-text)] transition-colors hover:bg-[var(--color-warm-bg)]">
          성도 찾기
        </Link>
      </div>

      {data.errors.length > 0 ? (
        <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          돌봄 목록을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.
        </div>
      ) : data.items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-[var(--color-warm-border)] bg-white p-6">
          <p className="font-medium text-[var(--color-warm-text)]">이번 주 예정된 돌봄이 없습니다.</p>
          <p className="mt-1 text-sm text-[var(--color-warm-muted)]">성도 상세에서 연락 기록과 다음 약속을 추가할 수 있습니다.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-[var(--color-warm-border)] bg-white">
          {data.items.map((item) => {
            const overdue = item.dueDate < today;
            return (
              <article key={item.id} className="flex flex-col gap-3 border-b border-[var(--color-warm-border-light)] p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/members/${item.memberId}`} className="text-base font-semibold text-[var(--color-warm-text)] underline decoration-[var(--color-warm-border)] underline-offset-4 hover:decoration-[var(--color-warm-text)]">
                      {item.memberName}
                    </Link>
                    <span className="rounded-md bg-[#edf5ed] px-2 py-0.5 text-xs font-medium text-[#3d6b3d]">{CASE_LABELS[item.caseType]}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-warm-text)]">{item.nextAction}</p>
                  <p className="mt-1 text-xs text-[var(--color-warm-muted)]">
                    담당 {item.assigneeName}{item.lastContactAt ? ` · 최근 확인 ${item.lastContactAt.slice(0, 10)}` : " · 아직 연락 기록 없음"}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-medium ${overdue ? "text-rose-600" : "text-[var(--color-warm-muted)]"}`}>
                  {dueLabel(today, item.dueDate)}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
