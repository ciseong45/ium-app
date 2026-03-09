"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/lib/RoleContext";

const menuItems = [
  { href: "/", label: "대시보드", icon: "🏠" },
  { href: "/members", label: "멤버 관리", icon: "👥" },
  { href: "/small-groups", label: "순관리", icon: "📋" },
  { href: "/attendance", label: "출석 관리", icon: "✅" },
  { href: "/new-family", label: "새가족", icon: "🤝" },
  { href: "/one-to-one", label: "1:1 양육", icon: "📖" },
];

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const role = useRole();

  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-64 transform bg-white shadow-lg transition-transform lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-lg font-bold text-gray-900">이음채플</h1>
        </div>

        <nav className="mt-4 space-y-1 px-3">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          {role === "admin" && (
            <Link
              href="/settings"
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === "/settings"
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="text-lg">&#x2699;&#xFE0F;</span>
              설정
            </Link>
          )}
        </nav>
      </aside>
    </>
  );
}
