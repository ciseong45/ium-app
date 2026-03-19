"use client";

import { useState } from "react";
import { submitVisitorCard } from "./actions";

const inputClass =
  "mt-2 block w-full border-b border-[var(--color-warm-border)] bg-transparent px-0 py-2.5 text-sm text-[var(--color-warm-text)] placeholder:text-[var(--color-warm-subtle)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:outline-none";

const labelClass =
  "block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-warm-muted)]";

const pillClass = (selected: boolean) =>
  `px-5 py-2.5 text-[13px] tracking-wide rounded-full border transition-all duration-300 cursor-pointer ${
    selected
      ? "border-[var(--color-warm-text)] bg-[var(--color-warm-text)] text-white shadow-sm"
      : "border-[var(--color-warm-border)] text-[var(--color-warm-muted)] hover:border-[var(--color-warm-text)] hover:text-[var(--color-warm-text)]"
  }`;

const selectClass =
  "mt-2 block w-full appearance-none border border-[var(--color-warm-border)] rounded-lg bg-transparent px-3 py-2.5 text-[13px] tracking-wide text-[var(--color-warm-text)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:outline-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239a9084%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat";

export default function VisitorCardPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [baptism, setBaptism] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await submitVisitorCard(formData);

    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error || "제출에 실패했습니다.");
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="grain-overlay flex min-h-screen items-center justify-center bg-[var(--color-warm-bg)] px-4">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="rounded-xl border border-[var(--color-warm-border)] bg-white p-10 shadow-[var(--shadow-elevated)]">
            <div className="editorial-divider mx-auto" />
            <h2 className="mt-6 font-serif text-2xl font-light tracking-tight text-[var(--color-warm-text)]">
              환영합니다
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-warm-muted)]">
              방문자 카드가 제출되었습니다.
              <br />
              이음채플에 오신 것을 환영합니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grain-overlay min-h-screen bg-[var(--color-warm-bg)] px-4 py-10">
      <div className="mx-auto w-full max-w-md animate-fade-in">
        {/* 헤더 */}
        <div className="mb-10 text-center">
          <h1 className="font-serif text-3xl font-light tracking-tight text-[var(--color-warm-text)]">
            I:UM Chapel
          </h1>
          <div className="editorial-divider mx-auto mt-4" />
          <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--color-warm-muted)]">
            방문자 카드
          </p>
          <p className="mt-3 text-sm text-[var(--color-warm-muted)]">
            이음채플에 오신 것을 환영합니다
          </p>
        </div>

        {/* 폼 */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[var(--color-warm-border)] bg-white p-8 shadow-[var(--shadow-elevated)] space-y-6"
        >
          {/* 성 + 이름 */}
          <div className="grid grid-cols-[1fr_2fr] gap-4">
            <div>
              <label className={labelClass}>
                성 <span className="text-rose-400">*</span>
              </label>
              <input name="last_name" type="text" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>
                이름 <span className="text-rose-400">*</span>
              </label>
              <input name="first_name" type="text" required className={inputClass} />
            </div>
          </div>

          {/* 카카오톡 아이디 */}
          <div>
            <label className={labelClass}>
              카카오톡 아이디 <span className="text-rose-400">*</span>
            </label>
            <input name="kakao_id" type="text" required className={inputClass} />
          </div>

          {/* 핸드폰 번호 */}
          <div>
            <label className={labelClass}>
              핸드폰 번호 <span className="text-rose-400">*</span>
            </label>
            <input
              name="phone"
              type="tel"
              required
              placeholder="010-0000-0000"
              className={inputClass}
            />
          </div>

          {/* 세례 입교 여부 */}
          <div>
            <label className={labelClass}>
              세례 입교 여부 <span className="text-rose-400">*</span>
            </label>
            <input type="hidden" name="baptism" value={baptism} required />
            <div className="mt-3 flex flex-wrap gap-2.5">
              {["성인세례", "입교", "해당 없음"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setBaptism(option)}
                  className={pillClass(baptism === option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* 생년월일 */}
          <div>
            <label className={labelClass}>
              생년월일 <span className="text-rose-400">*</span>
            </label>
            <input
              type="hidden"
              name="birth_date"
              value={birthYear && birthMonth && birthDay ? `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}` : ""}
              required
            />
            <div className="mt-2 grid grid-cols-3 gap-3">
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                className={`${selectClass} ${!birthYear ? "text-[var(--color-warm-subtle)]" : ""}`}
                required
              >
                <option value="" disabled>Year</option>
                {Array.from({ length: 30 }, (_, i) => 2006 - i).map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                className={`${selectClass} ${!birthMonth ? "text-[var(--color-warm-subtle)]" : ""}`}
                required
              >
                <option value="" disabled>Month</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m)}>{m}월</option>
                ))}
              </select>
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                className={`${selectClass} ${!birthDay ? "text-[var(--color-warm-subtle)]" : ""}`}
                required
              >
                <option value="" disabled>Day</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>{d}일</option>
                ))}
              </select>
            </div>
          </div>

          {/* 학교/직장 */}
          <div>
            <label className={labelClass}>
              학교/직장 <span className="text-rose-400">*</span>
            </label>
            <input name="school_work" type="text" required className={inputClass} />
          </div>

          {/* 성별 */}
          <div>
            <label className={labelClass}>
              성별 <span className="text-rose-400">*</span>
            </label>
            <input type="hidden" name="gender" value={gender} required />
            <div className="mt-3 flex gap-2.5">
              {[{ label: "남", value: "M" }, { label: "여", value: "F" }].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(opt.value)}
                  className={pillClass(gender === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 이전 교회 */}
          <div>
            <label className={labelClass}>
              이전에 참석하던 교회가 있다면 알려주세요
            </label>
            <input name="previous_church" type="text" className={inputClass} />
          </div>

          {error && <p className="text-[13px] text-rose-500">{error}</p>}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#1a1a1a] py-3 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333] disabled:opacity-40 disabled:pointer-events-none"
          >
            {loading ? "제출 중..." : "제출하기"}
          </button>
        </form>

        <p className="mt-8 text-center text-[10px] font-medium tracking-[0.2em] text-[var(--color-warm-subtle)] uppercase">
          이음채플 · I:UM Chapel
        </p>
      </div>
    </div>
  );
}
