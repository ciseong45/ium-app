"use client";

/**
 * 필터 버튼 필(pill) — 목록 필터링에 사용하는 공통 탭/필터 버튼
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
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
        active
          ? "bg-gray-900 text-white shadow-sm"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}
