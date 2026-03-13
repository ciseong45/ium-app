"use client";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <div className="editorial-divider mb-6" />
      <h2 className="font-serif text-xl font-light text-[var(--color-warm-text)]">
        문제가 발생했습니다
      </h2>
      <p className="mt-2 text-sm text-[var(--color-warm-muted)]">
        잠시 후 다시 시도해주세요.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333]"
      >
        다시 시도
      </button>
    </div>
  );
}
