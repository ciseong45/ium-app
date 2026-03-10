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
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
        active
          ? "bg-gray-900 text-white shadow-sm ring-1 ring-gray-900/10"
          : "bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 hover:text-gray-700 hover:ring-gray-300"
      }`}
    >
      {label}
    </button>
  );
}
