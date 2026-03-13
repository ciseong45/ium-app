import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <p className="font-serif text-[48px] font-light tracking-tight text-[var(--color-warm-border)]">
        404
      </p>
      <div className="editorial-divider mt-2 mb-6" />
      <h2 className="font-serif text-xl font-light text-[var(--color-warm-text)]">
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
  );
}
