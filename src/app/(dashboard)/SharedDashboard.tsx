"use client";

import { useState, type ReactNode, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "@/lib/command-center";
import { CALENDAR_CATEGORIES, CALENDAR_STATUSES, calendarRange, dateLabel, occursOn, safeLink, weekMonday } from "@/lib/shared-calendar";
import type { CalendarItem, DashboardNotice, SharedSchedule } from "@/lib/shared-calendar";
import { getSharedDashboard, saveDashboardNotice, saveSharedSchedule } from "./shared-dashboard-actions";
import type { ActionResult } from "@/lib/validations";

type Data = Awaited<ReturnType<typeof getSharedDashboard>>;
const panel = "rounded-xl border border-[var(--color-warm-border)] bg-white p-5";
const button = "rounded-lg border border-[var(--color-warm-border)] px-3 py-2 text-sm hover:bg-stone-100 disabled:opacity-50";
const input = "mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm";
const colors = { worship: "bg-indigo-50 text-indigo-900", formation: "bg-emerald-50 text-emerald-900", community: "bg-sky-50 text-sky-900", event: "bg-orange-50 text-orange-900", meeting: "bg-purple-50 text-purple-900", deadline: "bg-rose-50 text-rose-900" };
function status(item: CalendarItem) { return item.status === "recorded" ? "원본 등록" : CALENDAR_STATUSES[item.status]; }
function route(date: string, view: string) { return `/?date=${date}&view=${view}`; }

export default function SharedDashboard({ data, today, anchor, view, canManage }: { data: Data; today: string; anchor: string; view: "week" | "month"; canManage: boolean }) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const visible = data.items.filter(i => filter === "all" || i.category === filter);
  const start = view === "week" ? weekMonday(anchor) : calendarRange(anchor).start;
  const days = Array.from({ length: view === "week" ? 7 : 42 }, (_, n) => addDays(start, n));
  const detail = data.items.find(i => i.key === selected) ?? data.deadlines.find(i => i.key === selected);
  const previous = view === "week" ? addDays(anchor, -7) : addDays(anchor.slice(0, 7) + "-01", -1).slice(0, 7) + "-01";
  const next = view === "week" ? addDays(anchor, 7) : addDays(anchor.slice(0, 7) + "-01", 32).slice(0, 7) + "-01";
  return <div className="space-y-6">
    <header>
      <p className="text-xs tracking-widest text-stone-500">IUM CHAPEL · 함께 준비하는 사역</p>
      <h1 className="mt-2 font-serif text-3xl text-stone-800">사역 대시보드</h1>
      <p className="mt-2 text-sm text-stone-500">{dateLabel(today)} · 모든 날짜와 시간은 뉴욕 기준입니다.</p>
    </header>
    {data.errors.length > 0 && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{data.errors.join(", ")} 정보를 불러오지 못했습니다. 일부 일정이나 자료가 보이지 않을 수 있습니다. 잠시 후 새로고침해주세요.</p>}
    {data.notices.map(n => <section key={n.id} className={panel + " border-l-4 border-l-emerald-700"}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">{n.title}</h2><span className="text-xs text-stone-500">{dateLabel(n.end_date)}까지 안내</span></div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">{n.body}</p>
      {safeLink(n.link_url) && <a className="mt-3 inline-block text-sm underline" href={safeLink(n.link_url)!}>자세히 보기 →</a>}
      {canManage && <details className="mt-3 text-sm"><summary className="cursor-pointer text-stone-500">공지 수정</summary><NoticeForm today={today} notice={n} /></details>}
    </section>)}
    <section className={panel} aria-label="통합 캘린더">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-medium">통합 캘린더</h2><p className="mt-1 text-xs text-stone-500">공동 일정 · 행사 · 예배 자료를 한곳에서 확인하세요.</p></div>
        <div className="flex gap-1">
          <Link className={button + (view === "week" ? " bg-stone-100" : "")} href={route(anchor, "week")} aria-current={view === "week" ? "page" : undefined}>주간</Link>
          <Link className={button + (view === "month" ? " bg-stone-100" : "")} href={route(anchor, "month")} aria-current={view === "month" ? "page" : undefined}>월간</Link>
        </div>
      </div>
      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">{view === "month" ? anchor.slice(0, 7).replace("-", "년 ") + "월" : dateLabel(start) + " – " + dateLabel(days[6])}</h3>
        <div className="flex gap-1"><Link className={button} href={route(previous, view)} aria-label="이전 기간">←</Link><Link className={button} href={route(today, view)}>오늘</Link><Link className={button} href={route(next, view)} aria-label="다음 기간">→</Link></div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2" aria-label="일정 종류 필터">
        {[["all", "전체"], ...Object.entries(CALENDAR_CATEGORIES)].map(([key, label]) => <button key={key} className={button + (filter === key ? " bg-stone-800 text-white hover:bg-stone-700" : "")} onClick={() => setFilter(key)} aria-pressed={filter === key}>{label}</button>)}
      </div>
      <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 lg:grid">
        {["월", "화", "수", "목", "금", "토", "일"].map(d => <div key={d} className="bg-stone-50 p-2 text-center text-xs text-stone-500">{d}</div>)}
        {days.map(day => <div key={day} className={"min-h-28 min-w-0 bg-white p-2 " + (day.slice(0, 7) !== anchor.slice(0, 7) ? "bg-stone-50" : "")}>
          <p className={"mb-2 text-xs " + (day === today ? "font-bold text-emerald-700" : "text-stone-500")}>{Number(day.slice(-2))}{day === today ? " · 오늘" : ""}</p>
          <div className="space-y-1">{visible.filter(i => occursOn(i, day)).map(i => <button key={i.key} className={"w-full rounded p-2 text-left text-xs leading-relaxed " + colors[i.category] + (i.status === "cancelled" ? " opacity-60 line-through" : "")} onClick={() => setSelected(i.key)} aria-pressed={selected === i.key}><span className="block font-medium break-words">{i.title}</span><span className="block text-[10px]">{i.time?.slice(0, 5) || "시간 미정"} · {status(i)}</span></button>)}</div>
        </div>)}
      </div>
      <div className="space-y-4 lg:hidden">
        {days.filter(day => view === "week" || visible.some(i => occursOn(i, day))).map(day => <div key={day}>
          <h4 className={"mb-2 text-sm " + (day === today ? "font-bold text-emerald-700" : "text-stone-500")}>{dateLabel(day)}{day === today ? " · 오늘" : ""}</h4>
          <div className="space-y-2">{visible.filter(i => occursOn(i, day)).map(i => <button key={i.key} onClick={() => setSelected(i.key)} aria-pressed={selected === i.key} className={"flex w-full items-center justify-between gap-2 rounded-lg p-3 text-left text-sm " + colors[i.category]}><span className={i.status === "cancelled" ? "line-through" : ""}>{i.title}</span><span className="shrink-0 text-xs">{i.time?.slice(0, 5) || "시간 미정"} · {status(i)}</span></button>)}</div>
          {!visible.some(i => occursOn(i, day)) && <p className="text-xs text-stone-400">등록된 일정 없음</p>}
        </div>)}
      </div>
      {!visible.some(i => days.some(d => occursOn(i, d))) && <p className="py-4 text-center text-sm text-stone-500">이 기간에 표시할 일정이 없습니다.</p>}
      <p className="mt-3 text-xs leading-relaxed text-stone-500">잠정: 확인이 필요한 일정 · 원본 등록: 기존 행사·자료에 등록된 날짜이며 확정 여부는 원본에서 확인하세요.</p>
      {detail && <section aria-label="일정 상세" className="mt-5 rounded-lg bg-stone-50 p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-stone-500">{CALENDAR_CATEGORIES[detail.category]} · {status(detail)}</p><h3 className="mt-1 text-lg font-medium">{detail.title}</h3></div><button className={button} onClick={() => setSelected(null)} aria-label="일정 상세 닫기">닫기</button></div>
        <p className="mt-3 text-sm">{dateLabel(detail.date)}{detail.endDate !== detail.date ? " – " + dateLabel(detail.endDate) : ""} · {detail.time?.slice(0, 5) || "시간 미정"}</p>
        <p className="mt-1 text-sm text-stone-600">장소: {detail.location || "미정"} · 대상: {detail.audience || "미정"} · 담당: {detail.coordinator || "미정"}</p>
        {detail.description && <p className="mt-3 whitespace-pre-wrap text-sm text-stone-600">{detail.description}</p>}
        <div className="mt-3 flex flex-wrap gap-2">{detail.links.map((l, n) => <a key={n} className={button} href={l.href}>{l.label} →</a>)}</div>
        <p className="mt-3 text-xs text-stone-500">{detail.source} · 최근 수정 {detail.updatedAt.slice(0, 10)}</p>
        {canManage && detail.editable && !detail.editable.event_id && <details className="mt-4 text-sm"><summary className="cursor-pointer">일정 수정</summary><ScheduleForm key={detail.key} today={today} schedule={detail.editable} /></details>}
      </section>}
      {canManage && <details className="mt-5 border-t border-stone-200 pt-4 text-sm"><summary className="cursor-pointer font-medium">+ 공동 일정 등록</summary><ScheduleForm today={today} /></details>}
    </section>
    <div className="grid gap-5 md:grid-cols-2">
      <section className={panel}><h2 className="text-lg font-medium">이번 주 예배 자료</h2><p className="mt-1 text-xs text-stone-500">{dateLabel(today)}부터 7일 · 등록된 자료만 표시</p>
        {data.currentBrief && <p className="mt-4 text-sm">{data.currentBrief.sermon_title || data.currentBrief.title || "주간 자료"}{data.currentBrief.sermon_scripture ? " · " + data.currentBrief.sermon_scripture : ""}</p>}
        <div className="mt-4 space-y-4">{data.resources.map(i => <div key={i.key}><p className="mb-2 text-sm text-stone-600">{dateLabel(i.date)} · {i.title}</p><div className="flex flex-wrap gap-2">{i.links.map((l, n) => <a key={n} className={button} href={l.href}>{l.label} →</a>)}</div></div>)}</div>
        {!data.resources.length && <p className="mt-4 text-sm text-stone-500">아직 등록된 자료가 없습니다.</p>}
      </section>
      <section className={panel}><h2 className="text-lg font-medium">다가오는 주요 마감</h2><p className="mt-1 text-xs text-stone-500">오늘부터 28일 · 취소된 일정 제외</p>
        <div className="mt-3 divide-y divide-stone-100">{data.deadlines.map(i => <div key={i.key} className="py-3"><Link className="text-sm font-medium underline decoration-stone-300 underline-offset-4" href={route(i.date, "week")}>{i.title} →</Link><p className="mt-1 text-xs text-stone-500">{dateLabel(i.date)}{i.time ? " " + i.time.slice(0, 5) : ""} · {status(i)} · {i.coordinator || "담당 미정"}</p></div>)}</div>
        {!data.deadlines.length && <p className="mt-4 text-sm text-stone-500">등록된 마감이 없습니다.</p>}
      </section>
    </div>
    {canManage && <details className={panel + " text-sm"}><summary className="cursor-pointer font-medium">+ 대시보드 공지 등록</summary><p className="mt-2 text-xs text-stone-500">표시 종료일이 지나면 대시보드에서 자동으로 내려갑니다. 공동으로 공유할 내용만 작성해주세요.</p><NoticeForm today={today} /></details>}
  </div>;
}

function SaveForm({ action, children }: { action: (data: FormData) => Promise<ActionResult>; children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setPending(true); setMessage("");
    try { const result = await action(new FormData(form)); if (result.success) { setMessage("저장했습니다."); router.refresh(); } else setMessage(result.error || "저장하지 못했습니다."); }
    catch { setMessage("저장하지 못했습니다. 잠시 후 다시 시도해주세요."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="mt-4 space-y-3"><fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">{children}</fieldset><button className={button} disabled={pending}>{pending ? "저장 중…" : "저장"}</button><p role="status" className="text-sm text-stone-600">{message}</p></form>;
}
function Field({ title, children }: { title: string; children: ReactNode }) { return <label className="block text-sm text-stone-600">{title}{children}</label>; }
function ScheduleForm({ today, schedule: s }: { today: string; schedule?: SharedSchedule }) {
  return <SaveForm action={saveSharedSchedule}>
    <input type="hidden" name="id" value={s?.id || ""} />
    <Field title="일정 제목 *"><input className={input} name="title" defaultValue={s?.title} maxLength={180} required /></Field>
    <Field title="종류 *"><select className={input} name="category" defaultValue={s?.category || "event"}>{Object.entries(CALENDAR_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
    <Field title="상태 *"><select className={input} name="status" defaultValue={s?.status || "tentative"}>{Object.entries(CALENDAR_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
    <Field title="예배 종류 (예배 일정에만 적용)"><select className={input} name="service_type" defaultValue={s?.service_type || "주일"}>{["주일", "금요", "수련회", "특별", "기타"].map(t => <option key={t}>{t}</option>)}</select></Field>
    <Field title="시작일 *"><input className={input} type="date" name="start_date" defaultValue={s?.start_date || today} required /></Field>
    <Field title="종료일 (여러 날인 경우)"><input className={input} type="date" name="end_date" defaultValue={s?.end_date || ""} /></Field>
    <Field title="시작 시간 · 뉴욕 (빈칸이면 미정)"><input className={input} type="time" name="start_time" defaultValue={s?.start_time?.slice(0, 5) || ""} /></Field>
    <Field title="장소"><input className={input} name="location" defaultValue={s?.location || ""} /></Field>
    <Field title="참여 대상"><input className={input} name="audience" defaultValue={s?.audience || ""} /></Field>
    <Field title="담당 사역자 / 팀"><input className={input} name="coordinator" defaultValue={s?.coordinator || ""} /></Field>
    <Field title="관련 자료 주소"><input className={input} name="resource_url" defaultValue={s?.resource_url || ""} placeholder="https://…" /></Field>
    <Field title="공동 안내 내용"><textarea className={input} name="description" defaultValue={s?.description || ""} rows={3} /></Field>
  </SaveForm>;
}
function NoticeForm({ today, notice: n }: { today: string; notice?: DashboardNotice }) {
  return <SaveForm action={saveDashboardNotice}>
    <input type="hidden" name="id" value={n?.id || ""} />
    <Field title="공지 제목 *"><input className={input} name="title" defaultValue={n?.title} maxLength={180} required /></Field>
    <Field title="자세히 보기 주소"><input className={input} name="link_url" defaultValue={n?.link_url || ""} /></Field>
    <Field title="표시 시작일 *"><input className={input} type="date" name="start_date" defaultValue={n?.start_date || today} required /></Field>
    <Field title="표시 종료일 *"><input className={input} type="date" name="end_date" defaultValue={n?.end_date || addDays(today, 7)} required /></Field>
    <Field title="공동 공지 내용 *"><textarea className={input} name="body" defaultValue={n?.body} maxLength={3000} rows={3} required /></Field>
  </SaveForm>;
}
