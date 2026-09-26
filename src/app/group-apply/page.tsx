import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { campaignOpen, type Campaign } from "@/lib/small-group-registration";

export const dynamic = "force-dynamic";

export default async function GroupApplyPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("small_group_campaigns")
    .select("id,season_id,slug,title,intro,audience_description,audience_mode,status,opens_at,closes_at,timezone,announcement_text,contact_text,notice_version,notice_text,version")
    .eq("status", "published").order("opens_at", { ascending: false });
  const campaigns = (data ?? []) as Campaign[];
  return <main className="grain-overlay min-h-screen bg-[var(--color-warm-bg)] px-5 py-12 text-[var(--color-warm-text)]">
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-3xl">이음채플 순신청</h1>
      <p className="mt-3 text-sm text-[var(--color-warm-muted)]">신청할 모집을 선택해주세요.</p>
      {error ? <p className="mt-8 rounded-lg bg-white p-6">모집 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
        : campaigns.length === 0 ? <p className="mt-8 rounded-lg bg-white p-6">현재 안내 중인 모집이 없습니다.</p>
          : <div className="mt-8 space-y-3">{campaigns.map(c => <Link key={c.id} href={`/group-apply/${c.slug}`}
            className="block rounded-xl border border-[var(--color-warm-border)] bg-white p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]">
            <span className="text-xs text-[var(--color-warm-muted)]">{campaignOpen(c) ? "신청 접수 중" : "신청 예정 또는 마감"}</span>
            <h2 className="mt-2 text-lg font-medium">{c.title}</h2>
            <p className="mt-2 text-sm text-[var(--color-warm-muted)]">{c.audience_description}</p>
          </Link>)}</div>}
    </div>
  </main>;
}
