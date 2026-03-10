"use client";

import { useState } from "react";
import { submitVisitorCard } from "./actions";

export default function VisitorCardPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

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
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb] px-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-[var(--shadow-elevated)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-gray-900">
              환영합니다!
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-500">
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
    <div className="min-h-screen bg-[#f8f9fb] px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md">
            <span className="text-lg font-bold text-white">i</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">이음채플</h1>
          <p className="mt-0.5 text-[13px] font-medium tracking-wider text-gray-400">방문자 카드</p>
          <p className="mt-3 text-sm text-gray-400">
            이음채플에 오신 것을 환영합니다! 아래 정보를 작성해주세요.
          </p>
        </div>

        {/* 폼 */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[var(--shadow-elevated)] space-y-5"
        >
          {/* 이름 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600">
              성도 이름 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* 카카오톡 아이디 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600">
              카카오톡 아이디 <span className="text-red-500">*</span>
            </label>
            <input
              name="kakao_id"
              type="text"
              required
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* 핸드폰 번호 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600">
              핸드폰 번호 <span className="text-red-500">*</span>
            </label>
            <input
              name="phone"
              type="tel"
              required
              placeholder="010-0000-0000"
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* 세례 입교 여부 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600">
              세례 입교 여부 <span className="text-red-500">*</span>
            </label>
            <div className="mt-2 flex gap-3">
              {["성인세례", "입교", "해당 없음"].map((option) => (
                <label key={option} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="baptism"
                    value={option}
                    required
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 생년월일 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600">
              생년월일 <span className="text-red-500">*</span>
            </label>
            <input
              name="birth_date"
              type="date"
              required
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* 학교/직장 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600">
              학교/직장 <span className="text-red-500">*</span>
            </label>
            <input
              name="school_work"
              type="text"
              required
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* 성별 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600">
              성별 <span className="text-red-500">*</span>
            </label>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="gender"
                  value="M"
                  required
                  className="text-indigo-600"
                />
                <span className="text-sm text-gray-700">남</span>
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="gender"
                  value="F"
                  className="text-indigo-600"
                />
                <span className="text-sm text-gray-700">여</span>
              </label>
            </div>
          </div>

          {/* 이전 교회 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600">
              이전에 참석하던 교회가 있다면 알려주세요
            </label>
            <input
              name="previous_church"
              type="text"
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? "제출 중..." : "제출하기"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs font-medium tracking-wider text-gray-300">
          이음채플 | I:UM CHAPEL
        </p>
      </div>
    </div>
  );
}
