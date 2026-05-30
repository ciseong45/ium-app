"use client";

import { useState } from "react";
import { submitSummerApplication } from "./actions";

const inputClass =
  "mt-2 block w-full border-b border-[var(--color-warm-border)] bg-transparent px-0 py-2.5 text-sm text-[var(--color-warm-text)] placeholder:text-[var(--color-warm-subtle)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:outline-none";

const labelClass =
  "block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-warm-muted)]";

export default function SummerApplyForm({ seasonId }: { seasonId: number }) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("season_id", String(seasonId));
      const result = await submitSummerApplication(fd);
      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error || "신청에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="grain-overlay flex min-h-screen items-center justify-center bg-[var(--color-warm-bg)] px-4">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="rounded-xl border border-[var(--color-warm-border)] bg-white p-10 shadow-[var(--shadow-elevated)]">
            <div className="editorial-divider mx-auto" />
            <h2 className="mt-6 font-serif text-2xl font-light tracking-tight text-[var(--color-warm-text)]">
              신청이 완료되었습니다
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-warm-muted)]">
              여름순 신청을 받았습니다.
              <br />
              6월 7일 예배 후 순 배정 안내를 드릴게요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grain-overlay min-h-screen bg-[var(--color-warm-bg)] px-4 py-10">
      <div className="mx-auto w-full max-w-md animate-fade-in">
        <div className="mb-10 text-center">
          <h1 className="font-serif text-3xl font-light tracking-tight text-[var(--color-warm-text)]">
            I:UM Chapel
          </h1>
          <div className="editorial-divider mx-auto mt-4" />
          <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--color-warm-muted)]">
            2026 여름순 신청
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-warm-muted)]">
            여름순은 함께 역할을 나누며 세워가는 순입니다.
            <br />
            새가족과 방문자도 편하게 신청할 수 있습니다.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[var(--color-warm-border)] bg-white p-8 shadow-[var(--shadow-elevated)] space-y-6"
        >
          <div>
            <label className={labelClass}>
              이름 <span className="text-rose-400">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="홍길동"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>연락처</label>
            <input
              name="phone"
              type="tel"
              placeholder="010-0000-0000"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>전하고 싶은 말 (선택)</label>
            <input
              name="note"
              type="text"
              placeholder="예: 처음 왔어요, 새가족이에요 등"
              className={inputClass}
            />
          </div>

          {error && <p className="text-[13px] text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#1a1a1a] py-3 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333] disabled:opacity-40 disabled:pointer-events-none"
          >
            {loading ? "신청 중..." : "여름순 신청하기"}
          </button>
        </form>

        <p className="mt-8 text-center text-[10px] font-medium tracking-[0.2em] text-[var(--color-warm-subtle)] uppercase">
          이음채플 · I:UM Chapel · 2026 Summer
        </p>
      </div>
    </div>
  );
}
