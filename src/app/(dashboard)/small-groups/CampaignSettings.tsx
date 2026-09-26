"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign } from "@/lib/small-group-registration";
import { isoToChapelWall } from "@/lib/chapel-time";
import { saveCampaign, saveCampaignOperators, setCampaignStatus } from "./registration-actions";
import CampaignQr from "./CampaignQr";

const input = "mt-1 w-full rounded-lg border border-[var(--color-warm-border)] bg-white px-3 py-2 text-sm";
const label = "block text-xs text-[var(--color-warm-muted)]";

export default function CampaignSettings({ campaigns, seasonId, operatorSettings }: { campaigns: Campaign[]; seasonId: number;
  operatorSettings: { choices: { id: string; name: string }[]; assigned: Record<number, string[]> } }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draftOperators, setDraftOperators] = useState(operatorSettings.assigned);
  useEffect(() => setDraftOperators(operatorSettings.assigned), [operatorSettings.assigned]);
  const editing = campaigns.find(c => c.id === editingId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await saveCampaign(new FormData(event.currentTarget));
      if (!result.success) { setError(result.error); return; }
      setEditingId(null); router.refresh();
    } finally { setBusy(false); }
  }

  async function changeStatus(c: Campaign, status: Campaign["status"]) {
    if (status === "published" && !confirm(`"${c.title}" 모집을 공개하시겠습니까?`)) return;
    setBusy(true); setError("");
    try {
      const result = await setCampaignStatus(c.id, c.version, status);
      if (!result.success) { setError(result.error); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  async function saveOperators(campaignId: number) {
    setBusy(true); setError("");
    try { const result = await saveCampaignOperators(campaignId, draftOperators[campaignId] || []);
      if (!result.success) setError(result.error); else router.refresh();
    } finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-medium">모집 설정</h2><p className="mt-1 text-xs text-[var(--color-warm-muted)]">모집을 만든 뒤 기간과 안내를 설정하고 공개합니다.</p></div>
      <button type="button" onClick={() => setEditingId(0)} className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm text-white">+ 새 모집</button></div>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    {campaigns.map(c => <div key={c.id} className="rounded-xl border border-[var(--color-warm-border)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{c.title}</h3><p className="mt-1 text-xs text-[var(--color-warm-muted)]">{c.status} · {c.slug}</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditingId(c.id)} className="rounded border px-3 py-1.5 text-xs">편집</button>
          {c.status !== "published" && <button type="button" disabled={busy} onClick={() => changeStatus(c, "published")} className="rounded bg-[#1a1a1a] px-3 py-1.5 text-xs text-white">공개</button>}
          {c.status === "published" && <button type="button" disabled={busy} onClick={() => changeStatus(c, "paused")} className="rounded border px-3 py-1.5 text-xs">접수 중지</button>}
        </div></div>
      <div className="mt-4 flex flex-wrap items-center gap-2"><code className="break-all rounded bg-[var(--color-warm-bg)] px-2 py-1 text-xs">/group-apply/{c.slug}</code>
        <button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/group-apply/${c.slug}`)} className="rounded border px-3 py-1.5 text-xs">링크 복사</button></div>
      <div className="mt-3"><CampaignQr slug={c.slug} /></div>
      <div className="mt-4 border-t pt-4"><p className="text-xs font-medium">이 모집을 처리할 다락방장</p>
        {operatorSettings.choices.length === 0 ? <p className="mt-2 text-xs text-[var(--color-warm-muted)]">지정 가능한 다락방장 계정이 없습니다.</p>
          : <div className="mt-2 flex flex-wrap gap-3">{operatorSettings.choices.map(p => <label key={p.id} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={(draftOperators[c.id] || []).includes(p.id)} onChange={e => setDraftOperators(prev => ({ ...prev, [c.id]: e.target.checked ? [...(prev[c.id] || []), p.id] : (prev[c.id] || []).filter(id => id !== p.id) }))} />{p.name}</label>)}</div>}
        <button type="button" disabled={busy} onClick={() => saveOperators(c.id)} className="mt-3 rounded border px-3 py-1.5 text-xs disabled:opacity-40">담당자 저장</button>
      </div>
      <p className="mt-3 text-xs text-[var(--color-warm-muted)]">접수: {isoToChapelWall(c.opens_at) || "미설정"} ~ {isoToChapelWall(c.closes_at) || "미설정"} (뉴욕 시간)</p>
    </div>)}
    {editingId !== null && <div role="dialog" aria-modal="true" aria-label="모집 설정 편집" className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"><form onSubmit={submit} className="mx-auto my-6 max-w-xl space-y-4 rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h3 className="text-lg font-medium">{editing ? "모집 편집" : "새 모집"}</h3><button type="button" onClick={() => setEditingId(null)} aria-label="닫기">✕</button></div>
      <input type="hidden" name="season_id" value={seasonId} /><input type="hidden" name="campaign_id" value={editing?.id ?? ""} /><input type="hidden" name="version" value={editing?.version ?? 0} />
      <div><label className={label}>모집명 *</label><input className={input} name="title" required maxLength={100} defaultValue={editing?.title} /></div>
      <div><label className={label}>모집 코드 (영문·숫자·하이픈, 공개 후 변경 불가) *</label><input className={input} name="slug" required pattern="[a-z0-9][a-z0-9-]{2,79}" defaultValue={editing?.slug} /></div>
      <div><label className={label}>대상</label><select className={input} name="audience_mode" defaultValue={editing?.audience_mode || "all"}><option value="all">전체 신청</option><option value="new_and_change">신규·변경 희망자</option></select></div>
      <div><label className={label}>대상 안내</label><input className={input} name="audience_description" maxLength={500} defaultValue={editing?.audience_description} /></div>
      <div><label className={label}>모집 소개</label><textarea className={input} name="intro" rows={3} maxLength={2000} defaultValue={editing?.intro} /></div>
      <div className="grid grid-cols-2 gap-3"><div><label className={label}>시작 (뉴욕 시간)</label><input className={input} type="datetime-local" name="opens_at" defaultValue={isoToChapelWall(editing?.opens_at || null)} /></div>
        <div><label className={label}>마감 (뉴욕 시간)</label><input className={input} type="datetime-local" name="closes_at" defaultValue={isoToChapelWall(editing?.closes_at || null)} /></div></div>
      <div><label className={label}>배정 안내 문구</label><textarea className={input} name="announcement_text" rows={2} defaultValue={editing?.announcement_text} /></div>
      <div><label className={label}>문의 경로 *</label><input className={input} name="contact_text" maxLength={500} defaultValue={editing?.contact_text} /></div>
      <div><label className={label}>정보 이용 안내 *</label><textarea className={input} name="notice_text" rows={5} defaultValue={editing?.notice_text} /></div>
      <div><label className={label}>자료 보관 검토일 *</label><input className={input} type="date" name="retention_review_at" defaultValue={editing?.retention_review_at || ""} /></div>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-[#1a1a1a] py-3 text-sm text-white disabled:opacity-40">저장</button>
    </form></div>}
  </div>;
}
