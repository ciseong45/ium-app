"use client";

import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRole } from "@/lib/RoleContext";

const ROLE_LABELS = {
  admin: "관리자",
  upper_room_leader: "다락방장",
  group_leader: "순장",
} as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-50 text-red-600",
  upper_room_leader: "bg-purple-50 text-purple-600",
  group_leader: "bg-blue-50 text-blue-600",
};

const PAGE_TITLES: Record<string, string> = {
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

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const role = useRole();
  const pageTitle = getPageTitle(pathname);

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

  const initial = userEmail ? userEmail.charAt(0).toUpperCase() : "?";

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      {/* 왼쪽: 모바일 메뉴 + 페이지 제목 */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <h1 className="hidden text-lg font-semibold text-gray-900 lg:block">
          {pageTitle}
        </h1>
      </div>

      {/* 오른쪽: 유저 정보 + 로그아웃 */}
      <div className="flex items-center gap-3">
        {userEmail && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              {initial}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-700">
                {userEmail.split("@")[0]}
              </p>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_COLORS[role] ?? "bg-gray-100 text-gray-500"}`}
              >
                {ROLE_LABELS[role]}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
