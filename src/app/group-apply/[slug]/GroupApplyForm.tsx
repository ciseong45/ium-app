"use client";

import { useState } from "react";
import type { Campaign } from "@/lib/small-group-registration";

const field = "mt-2 w-full rounded-lg border border-[var(--color-warm-border)] bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-text)]";
const label = "block text-sm font-medium";

export default function GroupApplyForm({ campaign }: { campaign: Campaign }) {
  const [key] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/group-applications", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: campaign.slug, submissionKey: key,
          name: form.get("name"), country: form.get("country"), phone: form.get("phone"),
          kind: form.get("kind"), note: form.get("note") || "",
          consentVersion: campaign.notice_version, consentAccepted: form.get("consent") === "on",
          website: form.get("website") || "" }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "신청을 저장하지 못했습니다."); return; }
      setDone(true);
    } catch { setError("연결을 확인한 뒤 다시 시도해주세요."); }
    finally { setLoading(false); }
  }

  if (done) return <div className="mt-8 rounded-xl bg-white p-8 text-center shadow-[var(--shadow-card)]">
    <h2 className="font-serif text-2xl">신청을 받았습니다</h2>
    <p className="mt-4 text-sm leading-6 text-[var(--color-warm-muted)]">{campaign.announcement_text}</p>
    <p className="mt-3 text-xs text-[var(--color-warm-muted)]">접수는 순배정 확정을 의미하지 않습니다. 수정·취소는 {campaign.contact_text}</p>
  </div>;

  return <form onSubmit={submit} className="mt-8 space-y-5 rounded-xl border border-[var(--color-warm-border)] bg-white p-6 shadow-[var(--shadow-card)]">
    <div className="absolute -left-[10000px]" aria-hidden="true"><label htmlFor="group-website">웹사이트</label><input id="group-website" name="website" tabIndex={-1} autoComplete="off" /></div>
    <div><label className={label} htmlFor="group-name">이름 *</label><input className={field} id="group-name" name="name" required maxLength={80} autoComplete="name" /></div>
    <div><label className={label} htmlFor="group-phone">연락처 *</label><div className="flex gap-2">
      <select className={`${field} w-28 shrink-0`} name="country" aria-label="국가" defaultValue="US"><option value="US">미국 +1</option><option value="KR">한국 +82</option><option value="OTHER">기타 +</option></select>
      <input className={field} id="group-phone" name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="617 555 1234" />
    </div></div>
    <div><label className={label} htmlFor="group-kind">신청 구분 *</label><select className={field} id="group-kind" name="kind" required defaultValue="">
      <option value="" disabled>선택해주세요</option><option value="new">새로 참여</option>
      {campaign.audience_mode === "all" && <option value="continuing">계속 참여</option>}
      <option value="change">변경 희망</option>
    </select></div>
    <div><label className={label} htmlFor="group-note">배정 참고사항 (선택)</label><textarea className={field} id="group-note" name="note" maxLength={500} rows={3} /></div>
    <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" name="consent" required className="mt-1" /><span>아래 정보 이용 안내를 확인했습니다. *</span></label>
    <div className="rounded-lg bg-[var(--color-warm-bg)] p-4 text-xs leading-5 whitespace-pre-wrap text-[var(--color-warm-muted)]">{campaign.notice_text}</div>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <button disabled={loading} className="w-full rounded-lg bg-[#1a1a1a] px-4 py-3 text-sm text-white disabled:opacity-50">{loading ? "신청 중…" : "순신청하기"}</button>
    <p className="text-xs text-[var(--color-warm-muted)]">문의: {campaign.contact_text}</p>
  </form>;
}
