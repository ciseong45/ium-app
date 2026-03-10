"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
        </div>

        <p className="mt-8 text-center text-[10px] font-medium tracking-[0.2em] text-[var(--color-warm-subtle)] uppercase">
          이음채플
        </p>
      </div>
    </div>
  );
}
