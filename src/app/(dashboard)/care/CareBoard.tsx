"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCareAction, changeCareAction } from "./actions";
import { CARE_STATUS, CARE_EVENT, careCounts } from "@/lib/care";
import type { CareAction, CareEvent, CarePerson } from "@/lib/care";
import { CARD_CLASS, INPUT_CLASS, BTN_PRIMARY_CLASS, BTN_SECONDARY_CLASS } from "@/components/ui/constants";

type Props = { actions: CareAction[]; events: CareEvent[]; people: CarePerson[]; userId: string; isAdmin: boolean; today: string; memberId?: number };
export default function CareBoard(props: Props) {
  const { actions, events, people, userId, isAdmin, today, memberId } = props;
  const [filter, setFilter] = useState("open");
  const counts = careCounts(actions, today, userId);
  const filtered = actions.filter(a => {
    if (filter === "closed") return ["completed", "cancelled"].includes(a.status);
    if (!["open", "waiting"].includes(a.status)) return false;
    if (filter === "mine") return a.assigned_to === userId;
    if (filter === "handoffs") return a.handoff_to === userId;
    if (filter === "overdue") return a.due_date < today;
    if (filter === "unassigned") return !a.assigned_to;
    return true;
  });
  return <section className="space-y-4" aria-label="돌봄 후속 조치">
    <div><h2 className="font-serif text-2xl">{memberId ? "돌봄 후속 조치" : "이번 주 돌봄"}</h2>
      <p className="mt-2 text-sm text-[var(--color-warm-muted)]">누구에게 · 무엇을 · 언제까지 할지 함께 확인합니다. 인계는 상대가 수락한 뒤 완료됩니다.</p></div>
    {isAdmin && memberId && <CreateForm memberId={memberId} people={people} userId={userId} today={today} />}
    {isAdmin && !memberId && <p className="text-sm"><Link href="/members" className="underline">사람 상세에서 새 후속 조치 등록 →</Link></p>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="돌봄 필터">
      {[["open", `진행 중 ${counts.open}`], ["mine", `내 담당 ${counts.mine}`], ["handoffs", `인계 요청 ${counts.handoffs}`], ["overdue", `기한 지남 ${counts.overdue}`], ["unassigned", `미배정 ${counts.unassigned}`], ["closed", "완료·취소"]].map(([key, label]) => <button key={key} aria-pressed={filter === key} className={`rounded-full px-3 py-2 text-sm ${filter === key ? "bg-[#1a1a1a] text-white" : "bg-white border border-[var(--color-warm-border)]"}`} onClick={() => setFilter(key)}>{label}</button>)}
    </div>
    {filtered.length === 0 && <p className={`${CARD_CLASS} p-5 text-sm text-[var(--color-warm-muted)]`}>이 목록에 해당하는 후속 조치가 없습니다.</p>}
    {filtered.map(action => <ActionCard key={`${action.id}:${action.version}`} action={action} events={events.filter(e => e.action_id === action.id)} people={people} userId={userId} isAdmin={isAdmin} today={today} />)}
  </section>;
}
function CreateForm({ memberId, people, userId, today }: { memberId: number; people: CarePerson[]; userId: string; today: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  return <details className={`${CARD_CLASS} p-4`}><summary className="cursor-pointer text-sm font-medium">후속 조치 등록</summary>
    <form className="mt-4 space-y-3" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; const d = new FormData(form); setBusy(true); setMessage(""); try {
      const result = await createCareAction({ memberId, nextAction: d.get("nextAction"), dueDate: d.get("dueDate"), assigneeId: d.get("assigneeId") || null });
      if (result.success) { form.reset(); setMessage("등록했습니다."); router.refresh(); } else setMessage(result.error);
    } catch { setMessage("연결을 확인한 뒤 다시 시도해 주세요."); } finally { setBusy(false); } }}>
      <label className="block text-sm">다음 할 일<input required maxLength={500} name="nextAction" className={INPUT_CLASS} placeholder="예: 이번 주 통화로 순장 소개 일정 확인" /></label>
      <label className="block text-sm">기한<input required name="dueDate" type="date" defaultValue={today} className={INPUT_CLASS} /></label>
      <label className="block text-sm">담당자<select name="assigneeId" defaultValue={userId} className={INPUT_CLASS}><option value="">미배정</option>{people.map(p => <option key={p.id} value={p.id}>{p.name || "이름 미등록"}</option>)}</select></label>
      <p className="text-xs text-[var(--color-warm-muted)]">다른 담당자를 선택하면 인계 요청으로 등록됩니다. 기록은 관리자·등록자·담당자·인계받을 사람에게 공유됩니다.</p>
      <button disabled={busy} className={BTN_PRIMARY_CLASS}>{busy ? "등록 중…" : "등록"}</button><p role="status" className="text-sm">{message}</p>
    </form></details>;
}
function ActionCard({ action: a, events, people, userId, isAdmin, today }: { action: CareAction; events: CareEvent[]; people: CarePerson[]; userId: string; isAdmin: boolean; today: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const name = (id: string | null) => id ? people.find(p => p.id === id)?.name || "이름 미등록" : "미배정";
  const isOpen = ["open", "waiting"].includes(a.status); const canManage = isAdmin || a.assigned_to === userId;
  return <article className={`${CARD_CLASS} p-5 space-y-3`}>
    <div className="flex flex-wrap justify-between gap-2"><Link className="font-medium underline" href={`/members/${a.member_id}`}>{a.member ? a.member.last_name + a.member.first_name : "대상자 상세"}</Link><span className="text-sm">{CARE_STATUS[a.status]}</span></div>
    <p className="whitespace-pre-wrap break-words">{a.next_action}</p>
    <p className={`text-sm ${isOpen && a.due_date < today ? "text-rose-700" : "text-[var(--color-warm-muted)]"}`}>기한 {a.due_date} · 담당 {name(a.assigned_to)}{a.handoff_to && ` · ${name(a.handoff_to)} 수락 대기`}</p>
    {(canManage || a.handoff_to === userId) && <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); const d = new FormData(e.currentTarget); setBusy(true); setError("");
      try { const result = await changeCareAction({ id: a.id, version: a.version, operation: d.get("operation"), note: d.get("note"), targetId: d.get("targetId") || null, dueDate: d.get("dueDate") || undefined });
        if (result.success) router.refresh(); else setError(result.error);
      } catch { setError("연결을 확인한 뒤 다시 시도해 주세요."); } finally { setBusy(false); }
    }}>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-sm">처리<select name="operation" className={INPUT_CLASS}>
          {a.handoff_to === userId && isOpen && <><option value="accept">인계 수락</option><option value="decline">인계 거절</option></>}
          {canManage && (isOpen ? <><option value="complete">완료</option><option value="wait">응답 대기</option><option value="handoff">담당자 인계</option><option value="cancel">취소</option></> : <option value="reopen">다시 진행</option>)}
        </select></label>
        <label className="text-sm">다음 기한<input name="dueDate" type="date" defaultValue={a.due_date} className={INPUT_CLASS} /></label>
        <label className="text-sm">인계할 담당자<select name="targetId" className={INPUT_CLASS}><option value="">선택</option>{people.filter(p => p.id !== a.assigned_to).map(p => <option key={p.id} value={p.id}>{p.name || "이름 미등록"}</option>)}</select></label>
      </div>
      <label className="block text-sm">처리 내용<textarea name="note" maxLength={2000} rows={2} className={INPUT_CLASS} placeholder="연락 결과·다음 일정·인계 이유를 기록하세요. 수락 외에는 필수입니다." /></label>
      <button className={BTN_SECONDARY_CLASS} disabled={busy}>{busy ? "저장 중…" : "처리 저장"}</button><p role="alert" className="text-sm text-rose-700">{error}</p>
    </form>}
    <details className="border-t border-[var(--color-warm-border)] pt-3 text-sm"><summary className="cursor-pointer">처리 이력 {events.length}건</summary><ol className="mt-3 space-y-3">{events.map(e => <li key={e.id}><p className="text-xs text-[var(--color-warm-muted)]">{new Date(e.created_at).toLocaleString("ko-KR", { timeZone: "America/New_York" })} · {name(e.actor_id)} · {CARE_EVENT[e.operation] ?? e.operation}</p><p className="whitespace-pre-wrap break-words">{e.note}</p></li>)}</ol></details>
  </article>;
}
