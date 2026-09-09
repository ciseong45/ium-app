"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, getPreparationStatus, getRescheduleImpact, getWeekStart, sortOperationalTasks } from "@/lib/command-center";
import type { ActionResult } from "@/lib/validations";
import type {
  CommandCenterData,
  CommandDecision,
  CommandFollowup,
  CommandMinistry,
  CommandOccurrence,
  CommandResource,
  CommandTask,
  MinistryArea,
} from "@/types/command-center";
import {
  AREA_LABELS,
  PREPARATION_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/types/command-center";
import {
  applyPreparationTemplate,
  bootstrapFallPlan,
  cancelOccurrence,
  createDecision,
  createInboxItem,
  createMinistry,
  createOccurrence,
  createResource,
  createTask,
  decide,
  processInboxToTask,
  recordFollowupResponse,
  rescheduleOccurrence,
  saveWeeklyReview,
  setArchived,
  setOccurrenceTemplateSkip,
  setTodayFocus,
  startWaiting,
  transitionTask,
} from "./actions";

type Tab = "week" | "inbox" | "ministries" | "calendar" | "waiting" | "resources";

const TAB_LABELS: Array<{ id: Tab; label: string }> = [
  { id: "week", label: "이번 주" },
  { id: "inbox", label: "수집함" },
  { id: "ministries", label: "사역 현황" },
  { id: "calendar", label: "일정" },
  { id: "waiting", label: "대기·결정" },
  { id: "resources", label: "자료 찾기" },
];

const INPUT = "mt-1.5 block w-full rounded-lg border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] px-3 py-2.5 text-sm text-[var(--color-warm-text)] placeholder:text-[var(--color-warm-muted)] focus:border-[var(--color-warm-text)] focus:bg-white focus:outline-none";
const LABEL = "text-[11px] font-medium text-[var(--color-warm-secondary)]";
const CARD = "rounded-xl border border-[var(--color-warm-border)] bg-white shadow-[var(--shadow-card)]";
const PRIMARY = "rounded-lg bg-[#1a1a1a] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#333] disabled:opacity-40";
const SECONDARY = "rounded-lg border border-[var(--color-warm-border)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-warm-text)] transition hover:border-[var(--color-warm-text)]";
const TINY = "rounded-md border border-[var(--color-warm-border)] px-2.5 py-1.5 text-[11px] text-[var(--color-warm-secondary)] transition hover:border-[var(--color-warm-text)] hover:text-[var(--color-warm-text)]";

const AREA_OPTIONS = Object.entries(AREA_LABELS) as Array<[MinistryArea, string]>;
const TEMPLATE_KIND_LABELS = {
  worship: "예배",
  course: "교육·양육",
  event: "행사",
  newcomer: "새가족 후속",
} as const;

function displayDate(value: string | null) {
  if (!value) return "날짜 확인 필요";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" }).format(date);
}

function statusTone(status: string) {
  if (["completed", "ready", "confirmed", "decided", "published", "received"].includes(status)) return "bg-emerald-50 text-emerald-700";
  if (["action_required", "cancelled", "needs_update"].includes(status)) return "bg-red-50 text-red-700";
  if (["waiting", "needs_information", "tentative", "on_hold", "open"].includes(status)) return "bg-amber-50 text-amber-700";
  return "bg-stone-100 text-stone-600";
}

function Badge({ status, label }: { status: string; label: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${statusTone(status)}`}>{label}</span>;
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-[9px] font-medium uppercase tracking-[0.24em] text-[var(--color-warm-muted)]">{eyebrow}</p>
        <h2 className="mt-1 font-serif text-xl font-light text-[var(--color-warm-text)]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function ActionForm({
  action,
  children,
  submitLabel,
  compact = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  return (
    <form
      className={compact ? "space-y-2" : "space-y-4"}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setPending(true);
        setMessage(null);
        setMessageIsError(false);
        try {
          const result = await action(new FormData(form));
          if (result.success) {
            form.reset();
            setMessage(result.warning ?? null);
            router.refresh();
          } else {
            setMessage(result.error);
            setMessageIsError(true);
          }
        } catch {
          setMessage("처리 중 문제가 발생했습니다. 다시 시도해주세요.");
          setMessageIsError(true);
        } finally {
          setPending(false);
        }
      }}
    >
      {children}
      {message && <p className={`text-xs ${messageIsError ? "text-red-600" : "text-amber-700"}`}>{message}</p>}
      <button type="submit" disabled={pending} className={compact ? SECONDARY : PRIMARY}>
        {pending ? "저장 중…" : submitLabel}
      </button>
    </form>
  );
}

function QuickCapture() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className={`${CARD} flex flex-col gap-3 p-3 sm:flex-row sm:items-center`}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setPending(true);
        setMessage(null);
        try {
          const result = await createInboxItem(new FormData(form));
          if (result.success) {
            form.reset();
            router.refresh();
          } else setMessage(result.error);
        } catch {
          setMessage("기록 중 문제가 발생했습니다. 다시 시도해주세요.");
        } finally {
          setPending(false);
        }
      }}
    >
      <input name="content" required className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[var(--color-warm-muted)]" placeholder="카톡·구두 요청·회의 메모를 한 줄로 빠르게 기록" />
      <input name="source" className="w-full rounded-md border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] px-3 py-2 text-xs outline-none sm:w-32" placeholder="출처 (선택)" />
      <button className={PRIMARY} disabled={pending}>{pending ? "기록 중…" : "+ 빠른 기록"}</button>
      {message && <p className="px-2 text-xs text-red-600">{message}</p>}
    </form>
  );
}

export default function CommandCenterView({ data, today }: { data: CommandCenterData; today: string }) {
  const [tab, setTab] = useState<Tab>("week");
  const activeSeason = data.seasons.find((season) => season.is_active) ?? data.seasons[0];
  const inboxCount = data.inbox.filter((item) => item.status === "unprocessed" && !item.archived_at).length;
  const dueWaiting = data.followups.filter((item) => item.status === "waiting" && item.next_check_date <= today && !item.archived_at).length;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 animate-fade-in">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.26em] text-[var(--color-warm-muted)]">Personal Ministry OS</p>
          <h1 className="mt-1 font-serif text-3xl font-light tracking-tight text-[var(--color-warm-text)]">이음채플 · 개인 총괄</h1>
          <p className="mt-2 text-xs text-[var(--color-warm-muted)]">
            {activeSeason ? `${activeSeason.name} · ${displayDate(activeSeason.start_date)}–${displayDate(activeSeason.end_date)}` : "시즌 정보 없음"}
            <span className="mx-2">·</span>America/New_York
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 xl:max-w-2xl">
          <QuickCapture />
          <a href="/command-center/export" className="self-end text-[10px] text-[var(--color-warm-muted)] underline-offset-4 hover:text-[var(--color-warm-text)] hover:underline">읽을 수 있는 JSON 백업 내려받기</a>
        </div>
      </header>

      {!data.ready && (
        <div className={`${CARD} border-amber-200 bg-amber-50 p-5`}>
          <p className="font-medium text-amber-900">개인 총괄 저장소 연결이 필요합니다.</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-700">화면과 보안 구조는 준비되었습니다. 데이터베이스에 Phase 19 연결 파일을 적용하면 바로 사용할 수 있습니다.</p>
        </div>
      )}

      {data.ready && data.seasons.length === 0 && (
        <BootstrapCard />
      )}

      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--color-warm-border)] pb-px">
        {TAB_LABELS.map((item) => {
          const count = item.id === "inbox" ? inboxCount : item.id === "waiting" ? dueWaiting : 0;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-medium transition ${tab === item.id ? "border-[#1a1a1a] text-[#1a1a1a]" : "border-transparent text-[var(--color-warm-muted)] hover:text-[#1a1a1a]"}`}
            >
              {item.label}{count > 0 && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] text-red-700">{count}</span>}
            </button>
          );
        })}
      </nav>

      {tab === "week" && <WeekView data={data} today={today} />}
      {tab === "inbox" && <InboxView data={data} />}
      {tab === "ministries" && <MinistriesView data={data} today={today} />}
      {tab === "calendar" && <CalendarView data={data} today={today} />}
      {tab === "waiting" && <WaitingView data={data} today={today} />}
      {tab === "resources" && <ResourcesView data={data} />}
    </div>
  );
}

function BootstrapCard() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className={`${CARD} p-6`}>
      <p className="font-serif text-xl">현재 가을 사역부터 시작하기</p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-warm-muted)]">확정된 9/13–9/27 온보딩과 10/4 야외예배를 등록하고, 미확정인 목적·장소·예산은 결정 대기로 구분합니다. 다시 실행해도 중복되지 않습니다.</p>
      {message && <p className="mt-3 text-xs text-red-600">{message}</p>}
      <button
        className={`${PRIMARY} mt-4`}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const result = await bootstrapFallPlan();
          if (result.success) router.refresh(); else setMessage(result.error);
          setPending(false);
        }}
      >{pending ? "불러오는 중…" : "2026 가을 기준 불러오기"}</button>
    </div>
  );
}

function WeekView({ data, today }: { data: CommandCenterData; today: string }) {
  const activeTasks = data.tasks.filter((task) => !task.archived_at && !["completed", "cancelled", "on_hold"].includes(task.status));
  const focus = activeTasks.filter((task) => task.today_focus_order !== null).sort((a, b) => (a.today_focus_order ?? 9) - (b.today_focus_order ?? 9));
  const weekEnd = addDays(getWeekStart(today), 6);
  const fourWeeks = addDays(today, 28);
  const operational = sortOperationalTasks(activeTasks.filter((task) => !task.due_date || task.due_date <= weekEnd), today);
  const schedule = data.occurrences.filter((item) => !item.archived_at && item.status !== "cancelled" && item.date_only && item.date_only >= today && item.date_only <= weekEnd);
  const upcoming = data.occurrences.filter((item) => !item.archived_at && item.status !== "cancelled" && item.date_only && item.date_only >= today && item.date_only <= fourWeeks);
  const overdue = activeTasks.filter((task) => task.due_date && task.due_date < today).length;
  const openDecisions = data.decisions.filter((decision) => !decision.archived_at && decision.status === "open" && (!decision.due_date || decision.due_date <= weekEnd)).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-6">
        <section className={`${CARD} p-5`}>
          <SectionHeading eyebrow="Today" title="오늘 끝낼 결과물" action={<span className="text-xs text-[var(--color-warm-muted)]">직접 선택 · 최대 3개</span>} />
          {focus.length === 0 ? <p className="rounded-lg bg-[var(--color-warm-bg)] p-4 text-sm text-[var(--color-warm-muted)]">업무 카드에서 오늘 결과물을 1–3개 선택하세요.</p> : (
            <div className="space-y-3">{focus.map((task) => <TaskCard key={task.id} task={task} data={data} today={today} />)}</div>
          )}
        </section>

        <section>
          <SectionHeading eyebrow="This Week" title="이번 주 실행" action={<TaskCreateDetails data={data} />} />
          {operational.length === 0 ? <div className={`${CARD} p-6 text-sm text-[var(--color-warm-muted)]`}>이번 주에 표시할 업무가 없습니다.</div> : (
            <div className="space-y-3">{operational.map((task) => <TaskCard key={task.id} task={task} data={data} today={today} />)}</div>
          )}
        </section>

        <section>
          <SectionHeading eyebrow="Next 4 Weeks" title="다가오는 4주" />
          <div className={`${CARD} divide-y divide-[var(--color-warm-border-light)]`}>
            {upcoming.length === 0 ? <p className="p-5 text-sm text-[var(--color-warm-muted)]">등록된 일정이 없습니다.</p> : upcoming.map((item) => {
              const ministry = data.ministries.find((value) => value.id === item.ministry_id);
              const linkedTasks = data.tasks.filter((task) => task.occurrence_id === item.id && !task.archived_at);
              const prep = getPreparationStatus(linkedTasks, today);
              return (
                <div key={item.id} className="grid gap-2 p-4 sm:grid-cols-[100px_1fr_auto] sm:items-center">
                  <p className="text-xs font-medium">{displayDate(item.date_only)}</p>
                  <div><p className="text-sm font-medium">{item.title}</p><p className="mt-0.5 text-[11px] text-[var(--color-warm-muted)]">{ministry?.title ?? "연결 사역 확인 필요"}</p></div>
                  <Badge status={prep} label={PREPARATION_STATUS_LABELS[prep]} />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className={`${CARD} p-5`}>
          <SectionHeading eyebrow="Attention" title="지금 확인할 일" />
          <div className="grid grid-cols-2 gap-3">
            <Metric value={overdue} label="마감 지남" urgent={overdue > 0} />
            <Metric value={data.followups.filter((item) => !item.archived_at && item.status === "waiting" && item.next_check_date <= today).length} label="오늘 응답 확인" />
            <Metric value={openDecisions} label="결정 필요" />
            <Metric value={data.inbox.filter((item) => !item.archived_at && item.status === "unprocessed").length} label="수집함 미정리" />
          </div>
        </section>

        <section className={`${CARD} p-5`}>
          <SectionHeading eyebrow="Schedule" title="이번 주 일정" />
          <div className="space-y-3">
            {schedule.length === 0 ? <p className="text-sm text-[var(--color-warm-muted)]">이번 주 일정이 없습니다.</p> : schedule.map((item) => <OccurrenceRow key={item.id} item={item} data={data} today={today} />)}
          </div>
        </section>

        <section className={`${CARD} p-5`}>
          <SectionHeading eyebrow="Weekly Review" title="주간 점검 기록" />
          <ActionForm action={saveWeeklyReview} submitLabel="주간 점검 저장" compact>
            <input type="hidden" name="week_start" value={getWeekStart(today)} />
            {focus.map((task) => <input key={task.id} type="hidden" name="focus_task_ids" value={task.id} />)}
            <textarea name="incomplete_judgment" rows={4} className={INPUT} placeholder="지난 주 후속, 이번 주 준비, 4주 마감, 결정 대기를 점검한 판단을 남깁니다." />
          </ActionForm>
          {data.weeklyReviews[0] && <p className="mt-3 text-[11px] text-[var(--color-warm-muted)]">최근 점검: {displayDate(data.weeklyReviews[0].week_start)}</p>}
        </section>
      </aside>
    </div>
  );
}

function Metric({ value, label, urgent = false }: { value: number; label: string; urgent?: boolean }) {
  return <div className="rounded-lg bg-[var(--color-warm-bg)] p-4"><p className={`font-serif text-2xl ${urgent ? "text-red-600" : "text-[var(--color-warm-text)]"}`}>{value}</p><p className="mt-1 text-[11px] text-[var(--color-warm-muted)]">{label}</p></div>;
}

function TaskCard({ task, data, today }: { task: CommandTask; data: CommandCenterData; today: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const ministry = data.ministries.find((item) => item.id === task.ministry_id);
  const overdue = task.due_date && task.due_date < today && !["completed", "cancelled"].includes(task.status);
  const run = async (action: Promise<ActionResult>) => {
    const result = await action;
    if (result.success) router.refresh(); else setMessage(result.error);
  };

  return (
    <article className={`${CARD} p-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={task.status} label={TASK_STATUS_LABELS[task.status]} />
            <span className="text-[10px] text-[var(--color-warm-muted)]">{AREA_LABELS[task.area]}</span>
            {task.is_required && <span className="text-[10px] font-medium text-red-500">필수</span>}
          </div>
          <h3 className="mt-2 text-sm font-medium text-[var(--color-warm-text)]">{task.title}</h3>
          {task.next_action && <p className="mt-1 text-xs text-[var(--color-warm-secondary)]">다음: {task.next_action}</p>}
          <p className={`mt-2 text-[11px] ${overdue ? "font-medium text-red-600" : "text-[var(--color-warm-muted)]"}`}>
            {task.due_date ? `기한 ${displayDate(task.due_date)}` : "기한 확인 필요"}
            {task.scheduled_date && ` · 실행 ${displayDate(task.scheduled_date)}`}
            {ministry && ` · ${ministry.title}`}
          </p>
          {task.blocked_reason && <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">막힌 일: {task.blocked_reason}</p>}
          {message && <p className="mt-2 text-[11px] text-red-600">{message}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button className={TINY} onClick={() => run(setTodayFocus(task.id, task.today_focus_order === null))}>{task.today_focus_order === null ? "오늘 선택" : "선택 해제"}</button>
          {task.status === "planned" && <button className={TINY} onClick={() => run(transitionTask(task.id, "in_progress"))}>시작</button>}
          {task.status === "on_hold" && <button className={TINY} onClick={() => run(transitionTask(task.id, "in_progress"))}>재개</button>}
          <button className={TINY} onClick={() => run(setArchived("task", task.id, true))}>보관</button>
        </div>
      </div>
      {task.status === "in_progress" && (
        <div className="mt-3 grid gap-3 border-t border-[var(--color-warm-border-light)] pt-3 lg:grid-cols-2">
          <details>
            <summary className="cursor-pointer text-[11px] font-medium">응답 대기로 전환</summary>
            <ActionForm action={(formData) => startWaiting(task.id, formData)} submitLabel="요청 기록" compact>
              <div className="grid grid-cols-2 gap-2 pt-2"><input name="person" required className={INPUT} placeholder="요청 상대" /><input name="next_check_date" type="date" required className={INPUT} /></div>
              <input name="request" required className={INPUT} placeholder="실제로 요청한 내용" />
              <input name="requested_at" type="date" defaultValue={today} className={INPUT} />
            </ActionForm>
          </details>
          <details>
            <summary className="cursor-pointer text-[11px] font-medium">완료 기록</summary>
            <ActionForm action={(formData) => transitionTask(task.id, "completed", formData)} submitLabel="완료 처리" compact>
              <textarea name="note" required className={INPUT} rows={2} placeholder="완료 기준 충족 근거 또는 직접 확인 메모" />
            </ActionForm>
          </details>
        </div>
      )}
    </article>
  );
}

function TaskCreateDetails({ data }: { data: CommandCenterData }) {
  return (
    <details className="relative">
      <summary className={`${SECONDARY} cursor-pointer list-none`}>+ 새 업무</summary>
      <div className={`${CARD} absolute right-0 z-20 mt-2 w-[min(92vw,560px)] p-5`}>
        <ActionForm action={createTask} submitLabel="업무 저장">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="업무 제목"><input name="title" required className={INPUT} /></Field>
            <Field label="사역 영역"><AreaSelect /></Field>
            <Field label="관련 사역"><MinistrySelect data={data} /></Field>
            <Field label="상태"><select name="status" className={INPUT}><option value="planned">예정</option><option value="in_progress">진행</option></select></Field>
            <Field label="기한"><input name="due_date" type="date" className={INPUT} /></Field>
            <Field label="실행 예정일"><input name="scheduled_date" type="date" className={INPUT} /></Field>
          </div>
          <Field label="다음 행동"><input name="next_action" className={INPUT} placeholder="바로 실행할 수 있는 동사형 행동" /></Field>
          <Field label="완료 기준"><input name="completion_criteria" className={INPUT} placeholder="무엇이 확인되면 끝인가?" /></Field>
          <div className="flex flex-wrap gap-4"><label className={LABEL}><input type="checkbox" name="is_required" value="true" defaultChecked className="mr-2" />필수 준비</label><label className={LABEL}>우선순위 <select name="priority" defaultValue="2" className="ml-2 rounded border p-1"><option value="1">P0</option><option value="2">P1</option><option value="3">P2</option><option value="4">P3</option></select></label></div>
        </ActionForm>
      </div>
    </details>
  );
}

function InboxView({ data }: { data: CommandCenterData }) {
  const items = data.inbox.filter((item) => !item.archived_at);
  return (
    <section>
      <SectionHeading eyebrow="Inbox" title={`미분류 기록 ${items.filter((item) => item.status === "unprocessed").length}건`} />
      {items.length === 0 ? <div className={`${CARD} p-8 text-center text-sm text-[var(--color-warm-muted)]`}>빠른 기록으로 첫 메모를 남겨보세요.</div> : (
        <div className="space-y-3">{items.map((item) => (
          <div key={item.id} className={`${CARD} p-4`}>
            <div className="flex items-start justify-between gap-4"><div><Badge status={item.status} label={item.status === "unprocessed" ? "미분류" : "처리됨"} /><p className="mt-2 text-sm leading-relaxed">{item.original_text}</p><p className="mt-2 text-[10px] text-[var(--color-warm-muted)]">{item.source || "출처 미기록"} · {displayDate(item.received_at)}</p></div><ArchiveButton kind="inbox" id={item.id} /></div>
            {item.status === "unprocessed" && (
              <details className="mt-3 border-t border-[var(--color-warm-border-light)] pt-3">
                <summary className="cursor-pointer text-xs font-medium">업무로 만들기</summary>
                <ActionForm action={(formData) => processInboxToTask(item.id, formData)} submitLabel="업무 생성" compact>
                  <div className="grid gap-2 pt-2 sm:grid-cols-2"><input name="title" required defaultValue={item.original_text.slice(0, 80)} className={INPUT} placeholder="업무 제목" /><AreaSelect /></div>
                  <input name="next_action" required className={INPUT} placeholder="다음 행동" />
                  <input name="due_date" type="date" className={INPUT} />
                  <MinistrySelect data={data} />
                </ActionForm>
              </details>
            )}
          </div>
        ))}</div>
      )}
    </section>
  );
}

function MinistriesView({ data, today }: { data: CommandCenterData; today: string }) {
  const ministries = data.ministries.filter((item) => !item.archived_at && !["completed", "cancelled"].includes(item.status));
  return (
    <div className="space-y-6">
      <section className={`${CARD} p-5`}>
        <details><summary className="cursor-pointer font-serif text-lg">+ 사역 묶음 만들기</summary>
          <div className="mt-4"><ActionForm action={createMinistry} submitLabel="사역 저장">
            <div className="grid gap-3 sm:grid-cols-3"><Field label="사역명"><input name="title" required className={INPUT} /></Field><Field label="영역"><AreaSelect /></Field><Field label="유형"><select name="kind" className={INPUT}><option value="recurring">반복 사역</option><option value="course">기간제 교육</option><option value="project">단일 프로젝트</option></select></Field></div>
            <Field label="목적 한 문장"><input name="purpose" className={INPUT} /></Field>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="시작일"><input name="start_date" type="date" className={INPUT} /></Field><Field label="종료일"><input name="end_date" type="date" className={INPUT} /></Field><Field label="시즌"><SeasonSelect data={data} /></Field></div>
            <Field label="현재 막힌 일"><input name="current_blocker" className={INPUT} /></Field>
          </ActionForm></div>
        </details>
      </section>
      <section>
        <SectionHeading eyebrow="Ministries" title="진행 중인 사역" />
        <div className="grid gap-4 lg:grid-cols-2">{ministries.map((ministry) => <MinistryCard key={ministry.id} ministry={ministry} data={data} today={today} />)}</div>
      </section>
    </div>
  );
}

function MinistryCard({ ministry, data, today }: { ministry: CommandMinistry; data: CommandCenterData; today: string }) {
  const tasks = data.tasks.filter((task) => task.ministry_id === ministry.id && !task.archived_at && task.status !== "cancelled");
  const nextTask = sortOperationalTasks(tasks.filter((task) => task.status !== "completed"), today)[0];
  const prep = getPreparationStatus(tasks, today);
  return (
    <article className={`${CARD} p-5`}>
      <div className="flex items-start justify-between"><div><p className="text-[10px] text-[var(--color-warm-muted)]">{AREA_LABELS[ministry.area]} · {ministry.kind === "recurring" ? "반복" : ministry.kind === "course" ? "교육" : "프로젝트"}</p><h3 className="mt-1 font-serif text-xl">{ministry.title}</h3></div><Badge status={prep} label={PREPARATION_STATUS_LABELS[prep]} /></div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--color-warm-secondary)]">{ministry.purpose || "목적 확인 필요"}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[11px]"><div><dt className="text-[var(--color-warm-muted)]">다음 마감</dt><dd className="mt-1">{nextTask ? `${displayDate(nextTask.due_date)} · ${nextTask.title}` : "없음"}</dd></div><div><dt className="text-[var(--color-warm-muted)]">가장 중요한 막힌 일</dt><dd className="mt-1 text-amber-800">{ministry.current_blocker || tasks.find((task) => task.blocked_reason)?.blocked_reason || "없음"}</dd></div></dl>
      <div className="mt-4 flex justify-between border-t border-[var(--color-warm-border-light)] pt-3"><span className="text-[10px] text-[var(--color-warm-muted)]">업무 {tasks.length}건</span><ArchiveButton kind="ministry" id={ministry.id} /></div>
    </article>
  );
}

function CalendarView({ data, today }: { data: CommandCenterData; today: string }) {
  const fourWeeks = addDays(today, 28);
  const items = data.occurrences.filter((item) => !item.archived_at && item.date_only && item.date_only >= today && item.date_only <= fourWeeks);
  return (
    <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
      <section className={`${CARD} p-5`}><SectionHeading eyebrow="New" title="일정 추가" /><ActionForm action={createOccurrence} submitLabel="일정 저장"><Field label="일정명"><input name="title" required className={INPUT} /></Field><Field label="관련 사역"><MinistrySelect data={data} required /></Field><div className="grid grid-cols-2 gap-3"><Field label="날짜"><input name="date_only" type="date" required className={INPUT} /></Field><Field label="확정 상태"><select name="status" className={INPUT}><option value="tentative">잠정</option><option value="confirmed">확정</option><option value="cancelled">취소</option></select></Field></div><Field label="장소"><input name="location" className={INPUT} /></Field><Field label="회차"><input name="sequence_label" className={INPUT} placeholder="예: 1/3" /></Field></ActionForm></section>
      <section><SectionHeading eyebrow="Next 4 Weeks" title="4주 일정" />
        <div className={`${CARD} divide-y divide-[var(--color-warm-border-light)]`}>{items.length === 0 ? <p className="p-6 text-sm text-[var(--color-warm-muted)]">앞으로 4주 일정이 없습니다.</p> : items.map((item) => <OccurrenceRow key={item.id} item={item} data={data} today={today} detailed />)}</div>
      </section>
    </div>
  );
}

function OccurrenceRow({ item, data, today, detailed = false }: { item: CommandOccurrence; data: CommandCenterData; today: string; detailed?: boolean }) {
  const tasks = data.tasks.filter((task) => task.occurrence_id === item.id && !task.archived_at);
  const prep = getPreparationStatus(tasks, today);
  const ministry = data.ministries.find((value) => value.id === item.ministry_id);
  const skip = data.occurrenceExceptions.find((exception) => exception.occurrence_id === item.id && exception.exception_type === "skip_generation");
  const runCount = data.templateRuns.filter((run) => run.occurrence_id === item.id).length;
  return (
    <div className={detailed ? "p-5" : "py-3 first:pt-0 last:pb-0"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium">{displayDate(item.date_only)} {item.sequence_label && `· ${item.sequence_label}`}</p>
          <p className="mt-1 text-sm">{item.title}</p>
          <p className="mt-1 text-[10px] text-[var(--color-warm-muted)]">{ministry?.title} · {item.location || "장소 확인 필요"} · {item.status === "confirmed" ? "확정" : item.status === "tentative" ? "잠정" : "취소"}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {skip && <Badge status="on_hold" label="준비 생성 제외" />}
          <Badge status={item.status === "cancelled" ? "cancelled" : prep} label={item.status === "cancelled" ? "일정 취소" : PREPARATION_STATUS_LABELS[prep]} />
        </div>
      </div>
      {detailed && (
        <>
          <div className="mt-3 flex justify-between">
            <span className="text-[10px] text-[var(--color-warm-muted)]">연결 준비 {tasks.length}건 · 양식 적용 {runCount}회</span>
            <ArchiveButton kind="occurrence" id={item.id} />
          </div>
          <OccurrenceControls item={item} data={data} tasks={tasks} today={today} skipReason={skip?.reason ?? null} />
        </>
      )}
    </div>
  );
}

function OccurrenceControls({
  item,
  data,
  tasks,
  today,
  skipReason,
}: {
  item: CommandOccurrence;
  data: CommandCenterData;
  tasks: CommandTask[];
  today: string;
  skipReason: string | null;
}) {
  const router = useRouter();
  const [newDate, setNewDate] = useState(item.date_only ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const impact = newDate ? getRescheduleImpact(tasks, newDate, today) : null;
  const run = async (result: Promise<ActionResult>) => {
    const value = await result;
    if (value.success) router.refresh(); else setMessage(value.error);
  };

  if (item.status === "cancelled") {
    const cancellation = data.occurrenceExceptions.find((exception) => exception.occurrence_id === item.id && exception.exception_type === "cancelled");
    return <p className="mt-3 rounded-lg bg-red-50 p-3 text-[11px] text-red-700">취소 이유: {cancellation?.reason || "이유 기록 확인 필요"} · 연결 업무는 자동 완료하지 않고 검토 대상으로 유지합니다.</p>;
  }

  return (
    <div className="mt-4 grid gap-3 border-t border-[var(--color-warm-border-light)] pt-3 lg:grid-cols-3">
      <details>
        <summary className="cursor-pointer text-[11px] font-medium">반복 준비 생성</summary>
        {skipReason ? (
          <div className="pt-2 text-[11px] text-amber-800">
            <p>제외 이유: {skipReason}</p>
            <button className={`${TINY} mt-2`} onClick={() => run(setOccurrenceTemplateSkip(item.id, false))}>제외 해제</button>
          </div>
        ) : (
          <ActionForm action={(formData) => applyPreparationTemplate(item.id, formData)} submitLabel="준비 업무 생성" compact>
            <select name="template_id" required className={INPUT} defaultValue="">
              <option value="" disabled>양식 선택</option>
              {data.templates.map((template) => <option key={template.id} value={template.id}>{template.name} v{template.version} · {TEMPLATE_KIND_LABELS[template.applies_to]}</option>)}
            </select>
            <p className="text-[10px] leading-relaxed text-[var(--color-warm-muted)]">같은 양식·같은 회차는 다시 실행해도 중복 생성되지 않습니다.</p>
          </ActionForm>
        )}
      </details>

      <details>
        <summary className="cursor-pointer text-[11px] font-medium">날짜 변경</summary>
        <ActionForm action={(formData) => rescheduleOccurrence(item.id, formData)} submitLabel="영향 확인 후 변경" compact>
          <input name="new_date" type="date" required value={newDate} onChange={(event) => setNewDate(event.target.value)} className={INPUT} />
          {impact && <p className="rounded-md bg-[var(--color-warm-bg)] p-2 text-[10px] leading-relaxed text-[var(--color-warm-secondary)]">자동 기한 {impact.shifted}건 이동 · 완료 {impact.preservedCompleted}건 유지 · 수동 기한 {impact.preservedManual}건 유지{impact.needsReschedule > 0 && ` · 변경 후 이미 지난 기한 ${impact.needsReschedule}건은 재조정 표시`}</p>}
          <input name="reason" required className={INPUT} placeholder="변경 이유" />
        </ActionForm>
      </details>

      <details>
        <summary className="cursor-pointer text-[11px] font-medium">예외·취소</summary>
        <div className="space-y-3 pt-2">
          <ActionForm action={(formData) => setOccurrenceTemplateSkip(item.id, true, formData)} submitLabel="이번 회차 준비 생성 제외" compact>
            <input name="reason" required className={INPUT} placeholder="예: 방학, 외부 진행" />
          </ActionForm>
          <ActionForm action={(formData) => cancelOccurrence(item.id, formData)} submitLabel="일정 취소 기록" compact>
            <input name="reason" required className={INPUT} placeholder="취소 이유" />
          </ActionForm>
        </div>
      </details>
      {message && <p className="text-[11px] text-red-600 lg:col-span-3">{message}</p>}
    </div>
  );
}

function WaitingView({ data, today }: { data: CommandCenterData; today: string }) {
  const followups = data.followups.filter((item) => !item.archived_at && item.status === "waiting");
  const decisions = data.decisions.filter((item) => !item.archived_at && item.status === "open");
  return (
    <div className="space-y-8">
      <section><SectionHeading eyebrow="Waiting" title="응답 대기" />
        <div className="grid gap-4 lg:grid-cols-2">{followups.length === 0 ? <div className={`${CARD} p-5 text-sm text-[var(--color-warm-muted)]`}>기다리는 응답이 없습니다.</div> : followups.map((item) => <FollowupCard key={item.id} item={item} data={data} today={today} />)}</div>
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div><SectionHeading eyebrow="Decisions" title="결정 대기" /><div className="space-y-3">{decisions.map((item) => <DecisionCard key={item.id} item={item} data={data} />)}</div></div>
        <div className={`${CARD} p-5`}><SectionHeading eyebrow="New" title="결정 기록" /><ActionForm action={createDecision} submitLabel="결정 대기 저장"><Field label="결정할 질문"><textarea name="question" required rows={2} className={INPUT} /></Field><Field label="선택지 (한 줄에 하나)"><textarea name="options" rows={3} className={INPUT} /></Field><Field label="판단에 필요한 정보"><input name="required_information" className={INPUT} /></Field><div className="grid grid-cols-2 gap-3"><Field label="결정 기한"><input name="due_date" type="date" className={INPUT} /></Field><Field label="관련 사역"><MinistrySelect data={data} /></Field></div></ActionForm></div>
      </section>
    </div>
  );
}

function FollowupCard({ item, data, today }: { item: CommandFollowup; data: CommandCenterData; today: string }) {
  const task = data.tasks.find((value) => value.id === item.task_id);
  return <article className={`${CARD} p-5`}><div className="flex justify-between"><Badge status={item.next_check_date <= today ? "action_required" : "waiting"} label={item.next_check_date <= today ? "오늘 확인" : "대기 중"} /><span className="text-[11px] text-[var(--color-warm-muted)]">다음 확인 {displayDate(item.next_check_date)}</span></div><h3 className="mt-3 text-sm font-medium">{item.request_text}</h3><p className="mt-1 text-xs text-[var(--color-warm-secondary)]">상대: {item.person_label} · 요청일 {displayDate(item.requested_at)}</p>{task && <p className="mt-2 text-[11px] text-[var(--color-warm-muted)]">영향 업무: {task.title}</p>}<details className="mt-4 border-t border-[var(--color-warm-border-light)] pt-3"><summary className="cursor-pointer text-xs font-medium">답변 기록</summary><ActionForm action={(formData) => recordFollowupResponse(item.id, formData)} submitLabel="답변 저장 후 업무로 돌아가기" compact><textarea name="response" required rows={2} className={INPUT} placeholder="받은 답" /><input name="next_action" required className={INPUT} placeholder="답변 이후 내가 할 다음 행동" /></ActionForm></details></article>;
}

function DecisionCard({ item, data }: { item: CommandDecision; data: CommandCenterData }) {
  const ministry = data.ministries.find((value) => value.id === item.ministry_id);
  return <article className={`${CARD} p-5`}><div className="flex items-start justify-between gap-4"><div><Badge status="open" label="결정 필요" /><h3 className="mt-2 text-sm font-medium">{item.question}</h3></div><span className="text-[11px] text-[var(--color-warm-muted)]">{displayDate(item.due_date)}</span></div>{item.options.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--color-warm-secondary)]">{item.options.map((option) => <li key={option}>{option}</li>)}</ul>}<p className="mt-3 text-[11px] text-[var(--color-warm-muted)]">필요 정보: {item.required_information || "확인 필요"}{ministry && ` · ${ministry.title}`}</p><details className="mt-4 border-t border-[var(--color-warm-border-light)] pt-3"><summary className="cursor-pointer text-xs font-medium">결정 확정</summary><ActionForm action={(formData) => decide(item.id, formData)} submitLabel="결정 저장" compact><input name="confirmed_choice" required className={INPUT} placeholder="확정 내용" /><textarea name="basis" rows={2} className={INPUT} placeholder="결정 근거" /></ActionForm></details></article>;
}

function ResourcesView({ data }: { data: CommandCenterData }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  const resources = useMemo(() => {
    return data.resources.filter((item) => !normalized || `${item.title} ${item.resource_type} ${item.source_url}`.toLocaleLowerCase("ko-KR").includes(normalized));
  }, [data.resources, normalized]);
  const history = useMemo(() => {
    const records: Array<{ kind: "task" | "ministry" | "occurrence" | "decision" | "inbox"; id: string; title: string; detail: string; archived: boolean }> = [
      ...data.tasks.filter((item) => item.archived_at || item.status === "completed" || item.status === "cancelled").map((item) => ({ kind: "task" as const, id: item.id, title: item.title, detail: `업무 · ${TASK_STATUS_LABELS[item.status]}`, archived: Boolean(item.archived_at) })),
      ...data.ministries.filter((item) => item.archived_at || item.status === "completed" || item.status === "cancelled").map((item) => ({ kind: "ministry" as const, id: item.id, title: item.title, detail: `사역 · ${AREA_LABELS[item.area]}`, archived: Boolean(item.archived_at) })),
      ...data.occurrences.filter((item) => item.archived_at || item.status === "cancelled").map((item) => ({ kind: "occurrence" as const, id: item.id, title: item.title, detail: `일정 · ${displayDate(item.date_only)}`, archived: Boolean(item.archived_at) })),
      ...data.decisions.filter((item) => item.archived_at || item.status !== "open").map((item) => ({ kind: "decision" as const, id: item.id, title: item.question, detail: `결정 · ${item.status === "decided" ? "확정" : "취소"}`, archived: Boolean(item.archived_at) })),
      ...data.inbox.filter((item) => item.archived_at).map((item) => ({ kind: "inbox" as const, id: item.id, title: item.original_text, detail: "수집 원문 · 보관", archived: true })),
    ];
    return records.filter((item) => !normalized || `${item.title} ${item.detail}`.toLocaleLowerCase("ko-KR").includes(normalized));
  }, [data, normalized]);
  return <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
    <section className={`${CARD} p-5`}><SectionHeading eyebrow="New" title="자료 연결" /><ActionForm action={createResource} submitLabel="자료 저장"><Field label="자료 제목"><input name="title" required className={INPUT} /></Field><Field label="원본 위치"><input name="source_url" required className={INPUT} placeholder="웹 주소 또는 기존 파일 경로" /></Field><div className="grid grid-cols-2 gap-3"><Field label="자료 유형"><input name="resource_type" className={INPUT} placeholder="교안, 기획안, 공지…" /></Field><Field label="버전 상태"><select name="version_status" className={INPUT}><option value="draft">초안</option><option value="confirmed">확정</option><option value="superseded">이전 버전</option></select></Field></div><Field label="관련 사역"><MinistrySelect data={data} /></Field><Field label="접근 범위"><input name="access_scope" className={INPUT} placeholder="예: 개인 Mac" /></Field></ActionForm></section>
    <section><SectionHeading eyebrow="Search" title="자료·완료·보관 기록 찾기" action={<input value={query} onChange={(event) => setQuery(event.target.value)} className="w-64 rounded-lg border border-[var(--color-warm-border)] bg-white px-3 py-2 text-xs outline-none" placeholder="제목·사역·날짜·경로 검색" />} />
      <div className="space-y-3">{resources.map((item) => <ResourceCard key={item.id} item={item} data={data} />)}</div>
      {history.length > 0 && <div className="mt-7"><p className="mb-3 text-[9px] font-medium uppercase tracking-[0.24em] text-[var(--color-warm-muted)]">Completed & Archived</p><div className={`${CARD} divide-y divide-[var(--color-warm-border-light)]`}>{history.map((item) => <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm">{item.title}</p><p className="mt-1 text-[10px] text-[var(--color-warm-muted)]">{item.detail}</p></div>{item.archived && <ArchiveButton kind={item.kind} id={item.id} archived />}</div>)}</div></div>}
      {resources.length === 0 && history.length === 0 && <div className={`${CARD} p-6 text-sm text-[var(--color-warm-muted)]`}>검색 결과가 없습니다.</div>}
    </section>
  </div>;
}

function ResourceCard({ item, data }: { item: CommandResource; data: CommandCenterData }) {
  const ministry = data.ministries.find((value) => value.id === item.ministry_id);
  const isWeb = /^https?:\/\//.test(item.source_url);
  return <article className={`${CARD} p-4 ${item.archived_at ? "opacity-60" : ""}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex gap-2"><Badge status={item.version_status} label={item.version_status === "confirmed" ? "확정본" : item.version_status === "draft" ? "초안" : "이전 버전"} />{item.archived_at && <Badge status="cancelled" label="보관됨" />}</div><h3 className="mt-2 text-sm font-medium">{item.title}</h3><p className="mt-1 text-[11px] text-[var(--color-warm-muted)]">{item.resource_type}{ministry && ` · ${ministry.title}`} · 확인 {item.verified_at ? displayDate(item.verified_at) : "필요"}</p><p className="mt-2 truncate text-[11px] text-[var(--color-warm-secondary)]" title={item.source_url}>{item.source_url}</p></div><div className="flex gap-2">{isWeb && <a href={item.source_url} target="_blank" rel="noreferrer" className={TINY}>원본 열기</a>}<ArchiveButton kind="resource" id={item.id} archived={Boolean(item.archived_at)} /></div></div></article>;
}

function ArchiveButton({ kind, id, archived = false }: { kind: "task" | "ministry" | "occurrence" | "decision" | "resource" | "inbox"; id: string; archived?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  return <div><button className={TINY} onClick={async () => { const result = await setArchived(kind, id, !archived); if (result.success) router.refresh(); else setMessage(result.error); }}>{archived ? "복원" : "보관"}</button>{message && <p className="mt-1 text-[10px] text-red-600">{message}</p>}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className={LABEL}>{label}{children}</label>;
}

function AreaSelect() {
  return <select name="area" className={INPUT}>{AREA_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>;
}

function MinistrySelect({ data, required = false }: { data: CommandCenterData; required?: boolean }) {
  return <select name="ministry_id" required={required} className={INPUT}><option value="">{required ? "사역 선택" : "연결 없음"}</option>{data.ministries.filter((item) => !item.archived_at).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>;
}

function SeasonSelect({ data }: { data: CommandCenterData }) {
  return <select name="season_id" className={INPUT}><option value="">시즌 없음</option>{data.seasons.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>;
}
