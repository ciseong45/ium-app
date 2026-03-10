/**
 * 데이터가 없을 때 표시하는 빈 상태 — 에디토리얼 미니멀
 */
export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="editorial-divider mb-6" />
      <p className="text-sm font-light text-[var(--color-warm-muted)]">{message}</p>
    </div>
  );
}
