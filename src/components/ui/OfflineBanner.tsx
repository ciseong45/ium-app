"use client";

import { useOnlineStatus } from "@/lib/useOnlineStatus";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 px-4 py-2 text-center text-xs font-medium text-white"
    >
      오프라인 상태입니다. 일부 기능이 제한될 수 있습니다.
    </div>
  );
}
