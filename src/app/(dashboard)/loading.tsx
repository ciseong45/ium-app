export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* 제목 스켈레톤 */}
      <div className="h-6 w-48 rounded bg-[var(--color-warm-border)]" />
      <div className="editorial-divider" />

      {/* 카드 스켈레톤 */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--color-warm-border)] bg-white p-6"
          >
            <div className="h-3 w-20 rounded bg-[var(--color-warm-border)]" />
            <div className="mt-4 h-10 w-16 rounded bg-[var(--color-warm-border)]" />
            <div className="mt-3 h-3 w-32 rounded bg-[var(--color-warm-border)]" />
          </div>
        ))}
      </div>

      {/* 테이블 스켈레톤 */}
      <div className="rounded-xl border border-[var(--color-warm-border)] bg-white p-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 w-24 rounded bg-[var(--color-warm-border)]" />
              <div className="h-4 w-32 rounded bg-[var(--color-warm-border)]" />
              <div className="h-4 w-16 rounded bg-[var(--color-warm-border)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
