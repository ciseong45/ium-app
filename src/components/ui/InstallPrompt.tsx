"use client";

import { useState, useEffect, useCallback } from "react";

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7일

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function getIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function getIsDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (!dismissedAt) return false;
  const elapsed = Date.now() - Number(dismissedAt);
  if (elapsed < DISMISS_DURATION_MS) return true;
  localStorage.removeItem(DISMISS_KEY);
  return false;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone] = useState(getIsStandalone);
  const [isDismissed, setIsDismissed] = useState(getIsDismissed);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferredPrompt(null);
  }, []);

  // 표시 조건: 비standalone + beforeinstallprompt 발생 + 닫지 않음
  if (isStandalone || !deferredPrompt || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-md animate-fade-in rounded-xl border border-[var(--color-warm-border)] bg-white p-4 shadow-[var(--shadow-elevated)] sm:left-auto sm:right-6 sm:max-w-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-2xl">📱</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-warm-text)]">
            홈 화면에 추가
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-warm-muted)]">
            앱처럼 빠르게 접근할 수 있습니다.
          </p>
          <button
            onClick={handleInstall}
            className="mt-2 rounded-lg bg-[#1a1a1a] px-4 py-1.5 text-xs font-medium text-white transition-all duration-300 hover:bg-[#333]"
          >
            설치하기
          </button>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="닫기"
          className="flex-shrink-0 text-[var(--color-warm-muted)] transition-colors hover:text-[var(--color-warm-text)]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 4L4 12M4 4L12 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
