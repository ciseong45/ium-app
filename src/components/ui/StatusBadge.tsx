import { STATUS_COLORS, getMainStatus, getSubStatus, type MemberStatus } from "@/types/member";

/**
 * 멤버 상태 뱃지 — 메인상태 + 보조상태(적응중 등) 표시
 */
export default function StatusBadge({ status }: { status: MemberStatus }) {
  const main = getMainStatus(status);
  const sub = getSubStatus(status);

  return (
    <span className="flex items-center gap-1">
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${main.color}`}
      >
        {main.label}
      </span>
      {sub && (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${sub.color}`}
        >
          {sub.label}
        </span>
      )}
    </span>
  );
}
