import { getActiveSummerSeason } from "./actions";
import SummerApplyForm from "./SummerApplyForm";

export const dynamic = "force-dynamic";

export default async function SummerApplyPage() {
  const season = await getActiveSummerSeason();

  if (!season) {
    return (
      <div className="grain-overlay flex min-h-screen items-center justify-center bg-[var(--color-warm-bg)] px-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-xl border border-[var(--color-warm-border)] bg-white p-10">
            <h2 className="font-serif text-2xl font-light text-[var(--color-warm-text)]">
              현재 신청 기간이 아닙니다
            </h2>
            <p className="mt-3 text-sm text-[var(--color-warm-muted)]">
              이음채플 공식 채널에서 안내를 확인해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <SummerApplyForm seasonId={season.id} />;
}
