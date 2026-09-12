"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/RoleContext";
import type { MemberCareData, CareLogItem } from "@/types/care";
import { recordCareFollowup } from "./actions";

const METHOD_LABELS: Record<CareLogItem["contactMethod"], string> = {
  message: "메시지",
  phone: "전화",
  in_person: "대면",
  other: "기타",
};

const OUTCOME_LABELS: Record<CareLogItem["outcome"], string> = {
  connected: "연결됨",
  awaiting_response: "응답 대기",
  scheduling: "일정 조율",
};

const VISIBILITY_LABELS: Record<CareLogItem["visibility"], string> = {
  assigned_leaders: "담당 리더 공유",
  pastoral_only: "지정 목양담당",
};

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function MemberCareSection({
  memberId,
  memberName,
  data,
}: {
  memberId: number;
  memberName: string;
  data: MemberCareData;
}) {
  const router = useRouter();
  const role = useRole();
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const activeCase = data.openCases[0] ?? null;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFeedback("");
    startTransition(async () => {
      const result = await recordCareFollowup(memberId, formData);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      setFeedback("돌봄 기록과 다음 약속을 저장했습니다.");
      setShowForm(false);
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="member-care-title" className="rounded-xl border border-[var(--color-warm-border)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-warm-muted)]">Care</p>
          <h3 id="member-care-title" className="mt-1 text-lg font-medium text-[var(--color-warm-text)]">목양과 다음 약속</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="min-h-11 rounded-lg bg-[#1a1a1a] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#333]"
        >
          연락 기록 · 다음 약속
        </button>
      </div>

      {data.errors.length > 0 && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          목양 정보를 모두 불러오지 못했습니다. 새로고침 후 다시 확인해주세요.
        </p>
      )}

      {activeCase ? (
        <div className="mt-4 rounded-lg bg-[var(--color-warm-bg)] p-4">
          <p className="text-xs font-medium text-[var(--color-warm-muted)]">다음 행동</p>
          <p className="mt-1 text-sm font-medium text-[var(--color-warm-text)]">{activeCase.nextAction}</p>
          <p className="mt-1 text-xs text-[var(--color-warm-muted)]">담당 {activeCase.assigneeName} · {activeCase.dueDate}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-warm-muted)]">열린 돌봄이 없습니다. 최근 연락과 다음 약속을 기록해 시작할 수 있습니다.</p>
      )}

      {showForm && (
        <form onSubmit={submit} className="mt-5 space-y-4 border-t border-[var(--color-warm-border-light)] pt-5">
          <input type="hidden" name="care_case_id" value={activeCase?.id ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-[var(--color-warm-text)]">
              연락 방법
              <select name="contact_method" defaultValue="message" className="mt-1.5 min-h-11 w-full rounded-lg border border-[var(--color-warm-border)] bg-white px-3 text-base">
                <option value="message">메시지</option>
                <option value="phone">전화</option>
                <option value="in_person">대면</option>
                <option value="other">기타</option>
              </select>
            </label>
            <label className="text-sm font-medium text-[var(--color-warm-text)]">
              결과
              <select name="outcome" defaultValue="connected" className="mt-1.5 min-h-11 w-full rounded-lg border border-[var(--color-warm-border)] bg-white px-3 text-base">
                <option value="connected">연결됨</option>
                <option value="awaiting_response">응답 대기</option>
                <option value="scheduling">일정 조율</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium text-[var(--color-warm-text)]">
            짧은 메모 <span className="font-normal text-[var(--color-warm-muted)]">· 선택</span>
            <textarea name="note" rows={2} maxLength={800} placeholder="확인한 사실과 다음 약속을 간단히 적어주세요." className="mt-1.5 w-full rounded-lg border border-[var(--color-warm-border)] bg-white p-3 text-base" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-[var(--color-warm-text)]">
              다음 행동
              <input name="next_action" required maxLength={180} defaultValue={activeCase?.nextAction ?? ""} placeholder="예: 금요일에 안부 다시 확인" className="mt-1.5 min-h-11 w-full rounded-lg border border-[var(--color-warm-border)] bg-white px-3 text-base" />
            </label>
            <label className="text-sm font-medium text-[var(--color-warm-text)]">
              다시 확인할 날짜
              <input type="date" name="due_date" required defaultValue={activeCase?.dueDate ?? defaultDueDate()} className="mt-1.5 min-h-11 w-full rounded-lg border border-[var(--color-warm-border)] bg-white px-3 text-base" />
            </label>
          </div>
          <label className="block text-sm font-medium text-[var(--color-warm-text)]">
            공개 범위
            <select name="visibility" defaultValue="assigned_leaders" className="mt-1.5 min-h-11 w-full rounded-lg border border-[var(--color-warm-border)] bg-white px-3 text-base">
              <option value="assigned_leaders">담당 리더 공유</option>
              {role === "admin" && <option value="pastoral_only">지정 목양담당</option>}
            </select>
          </label>
          <p className="text-xs leading-relaxed text-[var(--color-warm-muted)]">
            담당 리더 공유 기록은 이 성도를 맡은 리더에게 보입니다. 상담 전문이나 민감한 개인 사정은 적지 마세요.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={isPending} className="min-h-11 rounded-lg bg-[#1a1a1a] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {isPending ? "저장 중…" : "기록과 다음 약속 저장"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="min-h-11 rounded-lg border border-[var(--color-warm-border)] px-4 py-2.5 text-sm">
              취소
            </button>
          </div>
        </form>
      )}

      {feedback && <p role="status" className={`mt-4 text-sm ${feedback.includes("저장했습니다") ? "text-[#3d6b3d]" : "text-rose-600"}`}>{feedback}</p>}

      {data.logs.length > 0 && (
        <div className="mt-5 border-t border-[var(--color-warm-border-light)] pt-4">
          <h4 className="text-sm font-medium text-[var(--color-warm-text)]">최근 돌봄 이력</h4>
          <div className="mt-2 divide-y divide-[var(--color-warm-border-light)]">
            {data.logs.slice(0, 5).map((log) => (
              <article key={log.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-warm-muted)]">
                  <span>{log.contactedAt.slice(0, 10)}</span>
                  <span>{log.authorName}</span>
                  <span>{METHOD_LABELS[log.contactMethod]} · {OUTCOME_LABELS[log.outcome]}</span>
                  <span className="rounded-md bg-[var(--color-warm-bg)] px-2 py-0.5">{VISIBILITY_LABELS[log.visibility]}</span>
                </div>
                {log.note && <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--color-warm-text)]">{log.note}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
      <span className="sr-only">{memberName}님의 목양 기록</span>
    </section>
  );
}
