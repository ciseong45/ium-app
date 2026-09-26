import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { campaignOpen, type Campaign } from "@/lib/small-group-registration";
import GroupApplyForm from "./GroupApplyForm";

export const dynamic = "force-dynamic";

export default async function CampaignApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("small_group_campaigns")
    .select("id,season_id,slug,title,intro,audience_description,audience_mode,status,opens_at,closes_at,timezone,announcement_text,contact_text,notice_version,notice_text,version")
    .eq("slug", slug).in("status", ["published", "paused", "archived"]).maybeSingle();
  const campaign = data as Campaign | null;
  return <main className="grain-overlay min-h-screen bg-[var(--color-warm-bg)] px-5 py-12 text-[var(--color-warm-text)]">
    <div className="mx-auto max-w-lg">
      <Link href="/group-apply" className="text-sm text-[var(--color-warm-muted)]">← 모집 목록</Link>
      {error ? <p className="mt-8 rounded-lg bg-white p-6">신청 정보를 불러오지 못했습니다.</p>
        : !campaign ? <p className="mt-8 rounded-lg bg-white p-6">이 모집을 찾을 수 없습니다.</p>
          : <>
            <h1 className="mt-8 font-serif text-3xl">{campaign.title}</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--color-warm-muted)]">{campaign.intro}</p>
            <p className="mt-2 text-sm text-[var(--color-warm-muted)]">{campaign.audience_description}</p>
            {campaignOpen(campaign) ? <GroupApplyForm campaign={campaign} />
              : <div className="mt-8 rounded-xl bg-white p-6 text-sm">{campaign.status === "paused" ? "신청을 잠시 중지했습니다." : "현재 신청 기간이 아닙니다."}<p className="mt-3 text-[var(--color-warm-muted)]">{campaign.contact_text}</p></div>}
          </>}
    </div>
  </main>;
}
