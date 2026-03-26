"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/worship/planning/calendar", label: "캘린더" },
  { href: "/worship/planning/lineup", label: "라인업" },
  { href: "/worship/planning/conti", label: "콘티" },
  { href: "/worship/planning/songs", label: "곡 라이브러리" },
];

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* 서브 네비게이션 */}
      <div className="mb-8 flex gap-1 border-b border-[var(--color-warm-border)]">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`border-b-[1.5px] px-4 pb-2.5 pt-1 text-[13px] transition-all duration-300 ${
                active
                  ? "border-[var(--color-warm-text)] font-medium text-[var(--color-warm-text)]"
                  : "border-transparent text-[var(--color-warm-muted)] hover:text-[var(--color-warm-text)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
