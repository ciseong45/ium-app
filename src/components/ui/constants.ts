/** 공통 폼 입력 스타일 — 프리미엄 느낌의 subtle bg + refined focus */
export const INPUT_CLASS =
  "mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100";

/** 공통 select 스타일 */
export const SELECT_CLASS =
  "mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100";

/** 기본 카드 — 섬세한 다중 쉐도우 */
export const CARD_CLASS =
  "rounded-2xl bg-white border border-gray-100 shadow-[var(--shadow-card)]";

/** 인터랙티브 카드 (호버 효과) */
export const CARD_HOVER_CLASS =
  "rounded-2xl bg-white border border-gray-100 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:border-gray-200";

/** 페이지 제목 */
export const PAGE_TITLE_CLASS = "text-xl font-semibold tracking-tight text-gray-900";

/** 섹션 라벨 (소문자 + tracking) */
export const SECTION_LABEL_CLASS =
  "text-xs font-semibold text-gray-400 uppercase tracking-widest";

/** 기본 버튼 — 인디고 기반 프리미엄 */
export const BTN_PRIMARY_CLASS =
  "rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

/** 보조 버튼 */
export const BTN_SECONDARY_CLASS =
  "rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]";

/** 테이블 헤더 행 */
export const TABLE_HEADER_CLASS =
  "border-b border-gray-100 bg-gray-50/80 text-[11px] font-semibold text-gray-400 uppercase tracking-widest";

/** 테이블 바디 행 */
export const TABLE_ROW_CLASS =
  "border-b border-gray-50 transition-colors duration-150 hover:bg-indigo-50/30";
