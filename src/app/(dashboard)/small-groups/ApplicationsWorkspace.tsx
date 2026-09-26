"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelRegistration, confirmApplications, correctApplication, findMemberCandidates, markRegistrationDuplicate,
  markRegistrationInformed, prepareNewMember, resolveApplication, revokeConfirmedRegistration,
  saveAssignmentDraft } from "./registration-actions";
import type { Campaign, RegistrationApplication } from "@/lib/small-group-registration";

type Group = { id: number; name: string; leader: { last_name: string; first_name: string } | null };
type Filter = "pending" | "review" | "drafted" | "confirmed" | "all" | "legacy";

function filterApplication(a: RegistrationApplication, filter: Filter) {
  if (filter === "pending") return a.status === "pending" && ["exact_candidate", "linked", "new_prepared"].includes(a.match_status || "");
  if (filter === "review") return ["pending", "drafted"].includes(a.status) && ["review_required", "new_candidate"].includes(a.match_status || "");
  if (filter === "drafted") return a.status === "drafted";
  if (filter === "confirmed") return a.status === "confirmed";
  if (filter === "legacy") return ["legacy_review", "duplicate", "cancelled"].includes(a.status);
  return true;
}

const badge: Record<string, string> = {
  exact_candidate: "자동 일치", review_required: "확인 필요", new_candidate: "신규 확인",
  new_prepared: "신규 준비", linked: "연결 완료",
};

export default function ApplicationsWorkspace({ campaigns, selectedCampaignId, initialApplications, educationLabels,
  currentGroups, groupSizes, groups, seasonId }: {
  campaigns: Campaign[]; selectedCampaignId: number | null; initialApplications: RegistrationApplication[];
  educationLabels: Record<number, string>; currentGroups: Record<number, number>; groupSizes: Record<number, number>;
  groups: Group[]; seasonId: number;
}) {
  const router = useRouter();
  const campaign = campaigns.find(c => c.id === selectedCampaignId);
  const [applications, setApplications] = useState(initialApplications);
  const [filter, setFilter] = useState<Filter>("pending");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidates, setCandidates] = useState<{ id: number; first_name: string; last_name: string; phone: string | null; status: string }[]>([]);
  const [reason, setReason] = useState("");
  const [correctionName, setCorrectionName] = useState("");
  const [correctionPhone, setCorrectionPhone] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [representativeId, setRepresentativeId] = useState("");
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [revokeTarget, setRevokeTarget] = useState("");
  const [revokeReason, setRevokeReason] = useState("");

  useEffect(() => { setApplications(initialApplications); setSelected([]); setPage(0); setOperationId(crypto.randomUUID()); }, [initialApplications]);
  const visible = useMemo(() => applications.filter(a => filterApplication(a, filter) &&
    (!search || `${a.name} ${a.corrected_name || ""} ${a.phone || ""} ${a.corrected_phone || ""}`.toLowerCase().includes(search.toLowerCase()))), [applications, filter, search]);
  const pageRows = visible.slice(page * 50, (page + 1) * 50);
  const review = applications.find(a => a.id === reviewId);
  const revokeRow = applications.find(a => a.id === revokeId);
  const selectedRows = applications.filter(a => selected.includes(a.id));
  const ready = selectedRows.filter(a => a.status === "drafted" && a.proposed_group_id &&
    ["exact_candidate", "linked", "new_prepared"].includes(a.match_status || ""));
  const counts = {
    pending: applications.filter(a => filterApplication(a, "pending")).length,
    review: applications.filter(a => filterApplication(a, "review")).length,
    drafted: applications.filter(a => filterApplication(a, "drafted")).length,
    confirmed: applications.filter(a => filterApplication(a, "confirmed")).length,
  };
  const proposedChanges = useMemo(() => {
    const deltas: Record<number, number> = {};
    for (const a of applications) {
      if (a.status !== "drafted" || !a.proposed_group_id || !["exact_candidate", "linked", "new_prepared"].includes(a.match_status || "")) continue;
      const memberId = a.member_id ?? a.candidate_member_id;
      const previous = memberId ? currentGroups[memberId] : undefined;
      if (previous === a.proposed_group_id) continue;
      if (previous) deltas[previous] = (deltas[previous] || 0) - 1;
      deltas[a.proposed_group_id] = (deltas[a.proposed_group_id] || 0) + 1;
    }
    return deltas;
  }, [applications, currentGroups]);

  async function saveDraft(a: RegistrationApplication, groupId: number | null) {
    setBusy(true); setMessage("");
    try {
      const result = await saveAssignmentDraft(a.id, a.version, groupId);
      if (!result.success) { setMessage(result.error); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (ready.length !== selectedRows.length || ready.length === 0) {
      setMessage("확인 필요 또는 배정안이 없는 신청자가 포함됐습니다. 해당 항목을 제외해주세요."); return;
    }
    const summary = ready.map(a => `${a.corrected_name || a.name} → ${groups.find(g => g.id === a.proposed_group_id)?.name || "순 확인 필요"}`).join("\n");
    if (!window.confirm(`${ready.length}건의 성도 연결과 순배정을 확정합니다.\n\n${summary}`)) return;
    setBusy(true); setMessage("");
    try {
      const result = await confirmApplications(campaign!.id, operationId, ready.map(a => ({ id: a.id, version: a.version })));
      if (!result.success) { setMessage(result.error); return; }
      setSelected([]); setOperationId(crypto.randomUUID()); router.refresh();
    } catch {
      setMessage("결과를 확인하지 못했습니다. 같은 선택으로 다시 시도해주세요.");
    } finally { setBusy(false); }
  }

  async function searchMembers() {
    if (!campaign || candidateQuery.trim().length < 2) return;
    setBusy(true); setMessage("");
    try { setCandidates(await findMemberCandidates(campaign.id, candidateQuery)); }
    catch { setMessage("성도 후보를 불러오지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function connect(memberId: number) {
    if (!review || reason.trim().length < 3) { setMessage("연결 사유를 3자 이상 입력해주세요."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await resolveApplication(review.id, review.version, memberId, reason);
      if (!result.success) { setMessage(result.error); return; }
      setReviewId(null); setCandidates([]); setCandidateQuery(""); setReason(""); router.refresh();
    } finally { setBusy(false); }
  }

  function openReview(a: RegistrationApplication) {
    setReviewId(a.id); setCandidateQuery(a.corrected_name || a.name);
    setCorrectionName(a.corrected_name || a.name);
    setCorrectionPhone(a.corrected_phone || a.phone || "");
    setCorrectionNote(a.corrected_note ?? a.note ?? "");
    setReason(""); setCandidates([]);
  }

  async function correct() {
    if (!review || reason.trim().length < 3) { setMessage("정정 사유를 3자 이상 입력해주세요."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await correctApplication(review.id, review.version, correctionName, correctionPhone, correctionNote, reason);
      if (!result.success) { setMessage(result.error); return; }
      setReviewId(null); setReason(""); setCandidates([]); router.refresh();
    } finally { setBusy(false); }
  }

  async function prepareNew() {
    if (!review || reason.trim().length < 3) { setMessage("신규 확인 사유를 3자 이상 입력해주세요."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await prepareNewMember(review.id, review.version, lastName, firstName, reason);
      if (!result.success) { setMessage(result.error); return; }
      setReviewId(null); setReason(""); setLastName(""); setFirstName(""); router.refresh();
    } finally { setBusy(false); }
  }

  async function cancel(a: RegistrationApplication) {
    const reason = window.prompt(`${a.name} 신청을 취소하는 사유를 입력해주세요.`);
    if (reason === null) return;
    if (reason.trim().length < 3) { setMessage("취소 사유를 3자 이상 입력해주세요."); return; }
    setBusy(true); setMessage("");
    try { const result = await cancelRegistration(a.id, a.version, reason);
      if (!result.success) setMessage(result.error); else router.refresh();
    } finally { setBusy(false); }
  }

  async function duplicate() {
    if (!review || !representativeId || reason.trim().length < 3) { setMessage("대표 신청과 중복 처리 사유를 확인해주세요."); return; }
    setBusy(true); setMessage("");
    try { const result = await markRegistrationDuplicate(review.id, review.version, Number(representativeId), reason);
      if (!result.success) setMessage(result.error); else { setReviewId(null); router.refresh(); }
    } finally { setBusy(false); }
  }

  async function informed(a: RegistrationApplication, method: "direct" | "phone" | "message" | "other") {
    if (!window.confirm(`${a.name} 성도에게 실제로 배정 결과를 안내하셨나요?`)) return;
    setBusy(true); setMessage("");
    try { const result = await markRegistrationInformed(a.id, a.version, method);
      if (!result.success) setMessage(result.error); else router.refresh();
    } finally { setBusy(false); }
  }

  async function revokeConfirmed() {
    if (!revokeRow || !revokeRow.member_id || !revokeRow.assigned_group_id || revokeReason.trim().length < 3) {
      setMessage("현재 순과 취소 사유를 확인해주세요."); return;
    }
    const target = revokeTarget ? Number(revokeTarget) : null;
    if (!window.confirm(`${revokeRow.name} 성도의 확정 배정을 취소하고 ${target ? `${groups.find(g => g.id === target)?.name}으로 이동` : "순 소속에서 제외"}합니다.`)) return;
    setBusy(true); setMessage("");
    try {
      const result = await revokeConfirmedRegistration(revokeRow.id, revokeRow.version, revokeRow.assigned_group_id, target, revokeReason);
      if (!result.success) { setMessage(result.error); return; }
      setRevokeId(null); setRevokeReason(""); setRevokeTarget(""); router.refresh();
    } finally { setBusy(false); }
  }

  if (!campaign) return <div className="rounded-xl border border-[var(--color-warm-border)] bg-white p-8 text-sm text-[var(--color-warm-muted)]">이 학기의 모집이 없습니다. 모집 설정에서 먼저 만들어주세요.</div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-5 shadow-[var(--shadow-card)]">
      <div><label className="text-xs text-[var(--color-warm-muted)]" htmlFor="campaign-select">모집 선택</label>
        <select id="campaign-select" value={campaign.id} onChange={e => router.push(`/small-groups/${seasonId}?tab=applications&campaign=${e.target.value}`)}
          className="ml-3 rounded-lg border border-[var(--color-warm-border)] px-3 py-2 text-sm">
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select></div>
      <span className="text-xs text-[var(--color-warm-muted)]">{campaign.status === "published" ? "공개 중" : "비공개·종료"}</span>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[
      ["배정 대기", counts.pending], ["확인 필요", counts.review], ["배정안", counts.drafted], ["확정", counts.confirmed],
    ].map(([label, number]) => <div key={label} className="rounded-xl bg-white p-4 shadow-[var(--shadow-card)]"><div className="text-xs text-[var(--color-warm-muted)]">{label}</div><div className="mt-1 text-xl font-medium">{number}건</div></div>)}</div>
    <div className="rounded-xl border border-[var(--color-warm-border)] bg-white p-5">
      <div className="flex flex-wrap gap-2">{([
        ["pending", "배정 대기"], ["review", "확인 필요"], ["drafted", "배정안"], ["confirmed", "확정"], ["all", "전체"], ["legacy", "과거·취소"],
      ] as [Filter, string][]).map(([key, label]) => <button type="button" key={key} onClick={() => { setFilter(key); setSelected([]); setPage(0); setOperationId(crypto.randomUUID()); }}
        className={`rounded-full px-3 py-1.5 text-xs ${filter === key ? "bg-[#1a1a1a] text-white" : "bg-[var(--color-warm-bg)] text-[var(--color-warm-muted)]"}`}>{label}</button>)}</div>
      <input aria-label="신청자 이름 또는 연락처 검색" value={search} onChange={e => { setSearch(e.target.value); setSelected([]); setPage(0); setOperationId(crypto.randomUUID()); }}
        placeholder="이름 또는 연락처 검색" className="mt-4 w-full rounded-lg border border-[var(--color-warm-border)] px-3 py-2 text-sm sm:max-w-xs" />
      <p className="mt-2 text-xs text-[var(--color-warm-muted)]">검색 결과 {visible.length}건 · {page + 1}/{Math.max(1, Math.ceil(visible.length / 50))}쪽 · 한 번에 최대 100건 확정</p>
      {message && <p role="alert" className="mt-3 text-sm text-rose-600">{message}</p>}
      <div className="mt-4 space-y-2">{visible.length === 0 ? <p className="py-8 text-center text-sm text-[var(--color-warm-muted)]">해당 신청이 없습니다.</p> : pageRows.map(a => <div key={a.id} className="flex flex-col gap-3 rounded-lg border border-[var(--color-warm-border)] p-4 sm:flex-row sm:items-center">
        <input aria-label={`${a.name} 선택`} type="checkbox" checked={selected.includes(a.id)} disabled={busy || selected.length >= 100 && !selected.includes(a.id)}
          onChange={e => { setSelected(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id)); setOperationId(crypto.randomUUID()); }} />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{a.corrected_name || a.name}</strong><span className="rounded-full bg-[var(--color-warm-bg)] px-2 py-0.5 text-xs">{badge[a.match_status || ""] || a.match_status || "과거 기록"}</span><span className="text-xs text-[var(--color-warm-muted)]">{a.status}</span>{(a.corrected_name || a.corrected_phone || a.corrected_note !== null) && <span className="text-xs text-amber-700">정정됨</span>}</div>
          <p className="mt-1 text-xs text-[var(--color-warm-muted)]">{(a.corrected_phone || a.phone) ? `${(a.corrected_phone || a.phone)!.slice(0, -4).replace(/\d/g, "•")}${(a.corrected_phone || a.phone)!.slice(-4)}` : "연락처 없음"}{(a.corrected_note ?? a.note) ? ` · ${a.corrected_note ?? a.note}` : ""}</p>
          <p className="mt-1 text-xs text-[var(--color-warm-muted)]">교육: {educationLabels[a.member_id ?? a.candidate_member_id ?? -1] || "연결 후 확인"}{a.match_status === "exact_candidate" ? " (자동 대조 기준)" : ""} · 현재 순: {groups.find(g => g.id === currentGroups[a.member_id ?? a.candidate_member_id ?? -1])?.name || "없음"}</p>
          {a.assigned_group_id && <p className="mt-1 text-xs">확정 당시: {groups.find(g => g.id === a.assigned_group_id)?.name || "이전 순"}</p>}
        </div>
        {["pending", "drafted"].includes(a.status) && <div className="flex flex-wrap gap-2">
          <select aria-label={`${a.name} 배정할 순`} value={a.proposed_group_id ?? ""} disabled={busy} onChange={e => saveDraft(a, e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-[var(--color-warm-border)] px-2 py-2 text-xs"><option value="">순 선택</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <button type="button" disabled={busy} onClick={() => openReview(a)} className="rounded-lg border border-[var(--color-warm-border)] px-3 py-2 text-xs">성도 확인</button>
          <button type="button" disabled={busy} onClick={() => cancel(a)} className="rounded-lg border border-[var(--color-warm-border)] px-3 py-2 text-xs">신청 취소</button>
        </div>}
        {a.status === "confirmed" && <div className="flex flex-wrap items-center gap-2 text-xs">{a.informed_at ? "안내 완료" : <select aria-label={`${a.name} 안내 방식`} defaultValue="" disabled={busy}
          onChange={e => { if (e.target.value) informed(a, e.target.value as "direct" | "phone" | "message" | "other"); }} className="rounded-lg border p-2"><option value="">안내 완료 기록</option><option value="direct">직접 안내</option><option value="phone">전화</option><option value="message">메시지</option><option value="other">기타</option></select>}
          <button type="button" disabled={busy} onClick={() => setRevokeId(a.id)} className="rounded border px-2 py-2">배정 취소</button></div>}
      </div>)}</div>
      {visible.length > 50 && <div className="mt-4 flex items-center justify-between"><button type="button" disabled={page === 0} onClick={() => { setPage(p => p - 1); setSelected([]); setOperationId(crypto.randomUUID()); }} className="rounded border px-3 py-1.5 text-xs disabled:opacity-40">이전</button><span className="text-xs">{page + 1}/{Math.ceil(visible.length / 50)}</span><button type="button" disabled={(page + 1) * 50 >= visible.length} onClick={() => { setPage(p => p + 1); setSelected([]); setOperationId(crypto.randomUUID()); }} className="rounded border px-3 py-1.5 text-xs disabled:opacity-40">다음</button></div>}
      <div className="mt-6 border-t pt-4"><h3 className="text-sm font-medium">순별 배정 현황</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{groups.map(g => <div key={g.id} className="rounded-lg bg-[var(--color-warm-bg)] p-3 text-xs"><strong>{g.name}</strong><span className="ml-2 text-[var(--color-warm-muted)]">순장 {g.leader ? `${g.leader.last_name}${g.leader.first_name}` : "미정"}</span><p className="mt-1">현재 {groupSizes[g.id] || 0}명 · 배정안 반영 시 {(groupSizes[g.id] || 0) + (proposedChanges[g.id] || 0)}명</p></div>)}</div></div>
      {selected.length > 0 && <div className="sticky bottom-3 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#1a1a1a] p-3 text-sm text-white shadow-lg">
        <span>{selected.length}건 선택 · 확정 가능 {ready.length}건</span><button type="button" disabled={busy || ready.length === 0} onClick={confirm} className="rounded bg-white px-4 py-2 text-[#1a1a1a] disabled:opacity-40">연결·배정 확정</button>
      </div>}
    </div>
    {review && <div role="dialog" aria-modal="true" aria-label={`${review.name} 성도 확인`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[85vh] w-full max-w-md overflow-auto rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h3 className="text-lg font-medium">{review.name} 성도 확인</h3><button onClick={() => setReviewId(null)} aria-label="닫기">✕</button></div>
      <p className="mt-2 text-sm text-[var(--color-warm-muted)]">신청: {review.phone || "연락처 없음"} · {review.match_reason || "대조 필요"}</p>
      <p className="mt-1 text-xs text-[var(--color-warm-muted)]">원본 이름 {review.name} · 구분 {review.application_kind || "기록 없음"} · 메모 {review.note || "없음"}</p>
      <p className="mt-3 text-xs text-[var(--color-warm-muted)]">기존 성도의 이름·연락처를 확인한 뒤 연결해주세요. 신청 내용으로 성도 정보를 바꾸지 않습니다.</p>
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="정정·연결·신규·중복 처리 사유 (필수)" aria-label="처리 사유" className="mt-3 w-full rounded border px-3 py-2 text-sm" />
      <div className="mt-4 rounded-lg border p-3"><h4 className="text-sm font-medium">신청 내용 정정</h4><p className="mt-1 text-xs text-[var(--color-warm-muted)]">원본은 보존됩니다. 정정하면 성도 대조를 다시 수행하고 기존 연결은 해제됩니다.</p>
        <input value={correctionName} onChange={e => setCorrectionName(e.target.value)} aria-label="정정 이름" placeholder="이름" maxLength={80} className="mt-3 w-full rounded border px-3 py-2 text-sm" />
        <input value={correctionPhone} onChange={e => setCorrectionPhone(e.target.value)} aria-label="정정 연락처" placeholder="+1... 또는 +82..." className="mt-2 w-full rounded border px-3 py-2 text-sm" />
        <textarea value={correctionNote} onChange={e => setCorrectionNote(e.target.value)} aria-label="정정 메모" placeholder="메모" maxLength={500} className="mt-2 w-full rounded border px-3 py-2 text-sm" />
        <button type="button" disabled={busy || reason.trim().length < 3} onClick={correct} className="mt-2 rounded border px-3 py-2 text-xs disabled:opacity-40">정정 후 재대조</button></div>
      <div className="mt-4 flex gap-2"><input value={candidateQuery} onChange={e => setCandidateQuery(e.target.value)} aria-label="성도 검색" className="min-w-0 flex-1 rounded border px-3 py-2 text-sm" /><button disabled={busy} onClick={searchMembers} className="rounded border px-3 text-sm">검색</button></div>
      <div className="mt-4 space-y-2">{candidates.map(m => <div key={m.id} className="flex items-center justify-between rounded border p-3 text-sm"><span>{m.last_name}{m.first_name} · {m.phone || "번호 없음"} · {m.status}</span><button disabled={busy} onClick={() => connect(m.id)} className="rounded bg-[#1a1a1a] px-3 py-1 text-white">연결</button></div>)}</div>
      <div className="mt-5 border-t pt-4"><h4 className="text-sm font-medium">기존 성도가 없는 경우</h4><p className="mt-1 text-xs text-[var(--color-warm-muted)]">기존 명단을 먼저 검색하세요. 신규 준비 후 배정 확정 시 방문 성도 기록이 만들어집니다.</p>
        <div className="mt-3 flex gap-2"><input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="성" aria-label="새 성도 성" className="w-1/2 rounded border px-3 py-2 text-sm" /><input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="이름" aria-label="새 성도 이름" className="w-1/2 rounded border px-3 py-2 text-sm" /></div>
        <button type="button" disabled={busy || !lastName.trim() || !firstName.trim()} onClick={prepareNew} className="mt-3 rounded border px-3 py-2 text-xs disabled:opacity-40">신규 성도 준비</button>
      </div>
      <div className="mt-5 border-t pt-4"><h4 className="text-sm font-medium">중복 신청으로 처리</h4><select value={representativeId} onChange={e => setRepresentativeId(e.target.value)} aria-label="남길 대표 신청" className="mt-2 w-full rounded border px-3 py-2 text-sm"><option value="">남길 대표 신청 선택</option>{applications.filter(a => a.id !== review.id && !["cancelled", "duplicate", "legacy_review"].includes(a.status)).map(a => <option key={a.id} value={a.id}>{a.name} · #{a.id}</option>)}</select>
        <button type="button" disabled={busy || !representativeId} onClick={duplicate} className="mt-3 rounded border px-3 py-2 text-xs disabled:opacity-40">중복 처리</button></div>
      {message && <p role="alert" className="mt-3 text-sm text-rose-600">{message}</p>}
    </div></div>}
    {revokeRow && <div role="dialog" aria-modal="true" aria-label={`${revokeRow.name} 배정 취소`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h3 className="text-lg font-medium">{revokeRow.name} 배정 취소</h3><button type="button" onClick={() => setRevokeId(null)} aria-label="닫기">✕</button></div>
      <p className="mt-2 text-sm">확정 당시 순: {groups.find(g => g.id === revokeRow.assigned_group_id)?.name || "알 수 없음"} · 현재 순: {groups.find(g => g.id === currentGroups[revokeRow.member_id ?? -1])?.name || "없음"}</p>
      {currentGroups[revokeRow.member_id ?? -1] !== revokeRow.assigned_group_id ? <p className="mt-4 text-sm text-rose-600">확정 후 순이 변경됐습니다. 현재 순별 명단에서 확인해주세요.</p> : <>
        <label className="mt-4 block text-xs">취소 후 소속<select value={revokeTarget} onChange={e => setRevokeTarget(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="">순 소속에서 제외</option>{groups.filter(g => g.id !== revokeRow.assigned_group_id).map(g => <option key={g.id} value={g.id}>{g.name}으로 이동</option>)}</select></label>
        <label className="mt-4 block text-xs">사유<input value={revokeReason} onChange={e => setRevokeReason(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
        <button type="button" disabled={busy || revokeReason.trim().length < 3} onClick={revokeConfirmed} className="mt-4 w-full rounded bg-[#1a1a1a] py-2 text-sm text-white disabled:opacity-40">확정 배정 취소</button>
      </>}{message && <p role="alert" className="mt-3 text-sm text-rose-600">{message}</p>}
    </div></div>}
  </div>;
}
