"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import OfflineBanner from "./ui/OfflineBanner";
import InstallPrompt from "./ui/InstallPrompt";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="grain-overlay flex h-screen bg-[var(--color-warm-bg)]">
      <OfflineBanner />
      <InstallPrompt />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
