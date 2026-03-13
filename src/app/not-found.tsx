import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-warm-bg)] px-4">
      <div className="w-full max-w-md text-center animate-fade-in">
        <div className="rounded-xl border border-[var(--color-warm-border)] bg-white p-10 shadow-[var(--shadow-elevated)]">
          <p className="font-serif text-[64px] font-light tracking-tight text-[var(--color-warm-border)]">
            404
          </p>
          <div className="editorial-divider mx-auto mt-2" />
          <h2 className="mt-6 font-serif text-xl font-light text-[var(--color-warm-text)]">
            페이지를 찾을 수 없습니다
          </h2>
          <p className="mt-2 text-sm text-[var(--color-warm-muted)]">
            요청하신 페이지가 존재하지 않습니다.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333]"
          >
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
