"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRole } from "@/lib/RoleContext";

const ROLE_LABELS = { admin: "관리자", leader: "리더", viewer: "뷰어" } as const;

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const role = useRole();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then((res) => {
      setUserEmail(res.data.user?.email ?? null);
    }).catch(() => {
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
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
      >
        <svg
          className="h-6 w-6"
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

      <div className="lg:flex-1" />

      <div className="flex items-center gap-4">
        {userEmail && (
          <span className="hidden text-sm text-gray-500 sm:block">
            {userEmail}
            <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-400">
              {ROLE_LABELS[role]}
            </span>
          </span>
        )}
        <button
          onClick={handleSignOut}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
