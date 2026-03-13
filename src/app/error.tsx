"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-warm-bg)] px-4">
      <div className="w-full max-w-md text-center animate-fade-in">
        <div className="rounded-xl border border-[var(--color-warm-border)] bg-white p-10 shadow-[var(--shadow-elevated)]">
          <div className="editorial-divider mx-auto" />
          <h2 className="mt-6 font-serif text-2xl font-light tracking-tight text-[var(--color-warm-text)]">
            문제가 발생했습니다
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-warm-muted)]">
            잠시 후 다시 시도해주세요.
          </p>
          <button
            onClick={reset}
            className="mt-6 rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333]"
          >
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}
