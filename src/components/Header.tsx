"use client";

import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRole } from "@/lib/RoleContext";

const ROLE_LABELS = {
  admin: "관리자",
  upper_room_leader: "다락방장",
  group_leader: "순장",
  pending: "승인 대기",
} as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "text-[#1a1a1a]",
  upper_room_leader: "text-[#1a1a1a]",
  group_leader: "text-[#1a1a1a]",
};

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/members": "Members",
  "/small-groups": "Small Groups",
  "/attendance": "Attendance",
  "/new-family": "New Family",
  "/one-to-one": "Discipleship",
  "/settings": "Settings",
};

const PAGE_SUBTITLES: Record<string, string> = {
  "/": "대시보드",
  "/members": "멤버 관리",
  "/small-groups": "순관리",
  "/attendance": "출석 관리",
  "/new-family": "새가족",
  "/one-to-one": "1:1 양육",
  "/settings": "설정",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES).find(
    (k) => k !== "/" && pathname.startsWith(k)
  );
  return match ? PAGE_TITLES[match] : "";
}

function getPageSubtitle(pathname: string): string {
  if (PAGE_SUBTITLES[pathname]) return PAGE_SUBTITLES[pathname];
  const match = Object.keys(PAGE_SUBTITLES).find(
    (k) => k !== "/" && pathname.startsWith(k)
  );
  return match ? PAGE_SUBTITLES[match] : "";
}

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const role = useRole();
  const pageTitle = getPageTitle(pathname);
  const pageSubtitle = getPageSubtitle(pathname);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then((res) => {
        setUserEmail(res.data.user?.email ?? null);
      })
      .catch(() => {
        setUserEmail(null);
      });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--color-warm-border-light)] bg-white/80 px-5 backdrop-blur-xl lg:px-8">
      {/* 왼쪽: 모바일 메뉴 + 페이지 제목 */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-[var(--color-warm-muted)] transition-colors duration-300 hover:bg-[var(--color-warm-bg)] hover:text-[var(--color-warm-text)] lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>
        <div className="hidden lg:block">
          <h1 className="font-serif text-lg font-light tracking-tight text-[var(--color-warm-text)]">
            {pageTitle}
          </h1>
          <p className="text-[10px] font-medium tracking-[0.15em] text-[var(--color-warm-muted)]">
            {pageSubtitle}
          </p>
        </div>
      </div>

      {/* 오른쪽: 유저 정보 + 로그아웃 */}
      <div className="flex items-center gap-3">
        {userEmail && (
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[13px] font-medium text-[var(--color-warm-text)]">
                {userEmail.split("@")[0]}
              </span>
              <span className="text-[10px] font-medium tracking-[0.1em] text-[var(--color-warm-muted)] uppercase">
                {ROLE_LABELS[role]}
              </span>
            </div>
          </div>
        )}
        <div className="h-3 w-px bg-[var(--color-warm-border)] hidden sm:block" />
        <button
          onClick={handleSignOut}
          className="text-[12px] font-medium tracking-wide text-[var(--color-warm-muted)] transition-colors duration-300 hover:text-[var(--color-warm-text)]"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
