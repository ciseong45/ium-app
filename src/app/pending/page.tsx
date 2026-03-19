"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function PendingPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="grain-overlay flex min-h-screen items-center justify-center bg-[var(--color-warm-bg)]">
      <div className="w-full max-w-sm animate-fade-in px-4 text-center">
        <div className="mb-10">
          <h1 className="font-serif text-3xl font-light tracking-tight text-[var(--color-warm-text)]">
            I:UM Chapel
          </h1>
          <div className="editorial-divider mx-auto mt-4" />
        </div>

        <div className="rounded-xl border border-[var(--color-warm-border)] bg-white p-8 shadow-[var(--shadow-elevated)]">
          <h2 className="text-lg font-medium text-[var(--color-warm-text)]">
            승인 대기 중
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-warm-muted)]">
            가입이 완료되었습니다. 관리자의 승인 후 이용할 수 있습니다.
          </p>

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-6 w-full rounded-lg border border-[var(--color-warm-border)] bg-white py-3 text-sm font-medium text-[var(--color-warm-text)] transition-all duration-300 hover:border-[var(--color-warm-text)] hover:bg-[var(--color-warm-bg)]"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
