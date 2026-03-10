"use client";

/**
 * 필터 탭 — 에디토리얼 언더라인 스타일
 */
export default function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap border-b-[1.5px] px-3 pb-2 text-[13px] transition-all duration-300 ${
        active
          ? "border-[var(--color-warm-text)] font-medium text-[var(--color-warm-text)]"
          : "border-transparent text-[var(--color-warm-muted)] hover:text-[var(--color-warm-text)]"
      }`}
    >
      {label}
    </button>
  );
}
