import Link from "next/link";

export default function SummerApplyPage() {
  return <main className="grain-overlay flex min-h-screen items-center justify-center bg-[var(--color-warm-bg)] px-4">
    <div className="w-full max-w-md rounded-xl border border-[var(--color-warm-border)] bg-white p-8 text-center">
      <h1 className="font-serif text-2xl">여름순 신청이 종료되었습니다</h1>
      <p className="mt-3 text-sm text-[var(--color-warm-muted)]">새로운 순신청 안내는 모집 목록에서 확인해주세요.</p>
      <Link href="/group-apply" className="mt-6 inline-block rounded-lg bg-[#1a1a1a] px-5 py-3 text-sm text-white">순신청 모집 보기</Link>
    </div>
  </main>;
}
