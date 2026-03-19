"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // OAuth 콜백에서 전달된 에러 메시지 표시
  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(oauthError);
    }
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="grain-overlay flex min-h-screen items-center justify-center bg-[var(--color-warm-bg)]">
      <div className="w-full max-w-sm animate-fade-in px-4">
        {/* 브랜드 */}
        <div className="mb-10 text-center">
          <h1 className="font-serif text-3xl font-light tracking-tight text-[var(--color-warm-text)]">
            I:UM Chapel
          </h1>
          <div className="editorial-divider mx-auto mt-4" />
          <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--color-warm-muted)]">
            관리 시스템
          </p>
        </div>

        {/* 폼 */}
        <div className="rounded-xl border border-[var(--color-warm-border)] bg-white p-8 shadow-[var(--shadow-elevated)]">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-warm-muted)]"
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-2 block w-full border-b border-[var(--color-warm-border)] bg-transparent px-0 py-2.5 text-sm text-[var(--color-warm-text)] placeholder:text-[var(--color-warm-subtle)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:outline-none"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-warm-muted)]"
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-2 block w-full border-b border-[var(--color-warm-border)] bg-transparent px-0 py-2.5 text-sm text-[var(--color-warm-text)] placeholder:text-[var(--color-warm-subtle)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:outline-none"
                placeholder="비밀번호 입력"
              />
            </div>

            {error && (
              <p className="text-[13px] text-rose-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#1a1a1a] py-3 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333] disabled:opacity-40 disabled:pointer-events-none"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          {/* 구분선 */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-warm-border)]" />
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-warm-subtle)]">
              또는
            </span>
            <div className="h-px flex-1 bg-[var(--color-warm-border)]" />
          </div>

          {/* Google 로그인 */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--color-warm-border)] bg-white py-3 text-sm font-medium text-[var(--color-warm-text)] transition-all duration-300 hover:border-[var(--color-warm-text)] hover:bg-[var(--color-warm-bg)]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google로 로그인
          </button>
        </div>

        <p className="mt-8 text-center text-[10px] font-medium tracking-[0.2em] text-[var(--color-warm-subtle)] uppercase">
          이음채플
        </p>
      </div>
    </div>
  );
}
