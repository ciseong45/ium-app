"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessions, addSession, deleteSession } from "./actions";
import type { OneToOneEntry, OneToOneStatus, SessionEntry } from "@/types/one-to-one";
import { useRole } from "@/lib/RoleContext";

const STATUS_LABELS: Record<OneToOneStatus, string> = {
  active: "진행 중",
  paused: "일시정지",
  completed: "완료",
};

const STATUS_COLORS: Record<OneToOneStatus, string> = {
  active: "bg-[#edf5ed] text-[#3d6b3d]",
  paused: "bg-[#f5f0e0] text-[#8a7a56]",
  completed: "bg-[var(--color-warm-bg)] text-[var(--color-warm-muted)]",
};

export default function OneToOneCard({
  entry,
  onStatusChange,
  onDelete,
}: {
  entry: OneToOneEntry;
  onStatusChange: (id: number, status: OneToOneStatus) => void;
  onDelete: (id: number) => void;
}) {
  const router = useRouter();
  const role = useRole();
  const [expanded, setExpanded] = useState(false);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    const fetchSessions = async () => {
      try {
        const data = await getSessions(entry.id);
        if (!cancelled) setSessions(data);
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    };
    fetchSessions();
    return () => { cancelled = true; };
  }, [expanded, entry.id]);

  const handleAddSession = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const result = await addSession(entry.id, new FormData(e.currentTarget));
    if (result.success) {
      const updated = await getSessions(entry.id);
      setSessions(updated);
      setShowSessionForm(false);
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(false);
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm("이 세션을 삭제하시겠습니까?")) return;
    const result = await deleteSession(sessionId);
    if (result.success) {
      const updated = await getSessions(entry.id);
      setSessions(updated);
    } else {
      alert(result.error);
    }
  };

  return (
    <div className="hover-lift rounded-xl border border-[var(--color-warm-border)] bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-card-hover)]">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div
          className="flex-1 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--color-warm-text)]">
              {entry.mentor.last_name}{entry.mentor.first_name} → {entry.mentee.last_name}{entry.mentee.first_name}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.status]}`}
            >
              {STATUS_LABELS[entry.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-warm-muted)]">
            시작: {entry.started_at}
            {entry.completed_at && ` · 완료: ${entry.completed_at}`}
          </p>
        </div>

        {role !== "group_leader" && (
          <div className="flex gap-1">
            {entry.status === "active" && (
              <>
                <button
                  onClick={() => onStatusChange(entry.id, "paused")}
                  className="rounded-lg px-2 py-1 text-xs text-[#8a7a56] hover:bg-[#fdfbf5] transition-all duration-300"
                >
                  일시정지
                </button>
                <button
                  onClick={() => onStatusChange(entry.id, "completed")}
                  className="rounded-lg px-2 py-1 text-xs text-[#3d6b3d] hover:bg-[#edf5ed] transition-all duration-300"
                >
                  완료
                </button>
              </>
            )}
            {entry.status === "paused" && (
              <button
                onClick={() => onStatusChange(entry.id, "active")}
                className="rounded-lg px-2 py-1 text-xs text-[var(--color-warm-text)] hover:bg-[var(--color-warm-bg)] transition-all duration-300"
              >
                재개
              </button>
            )}
            {role === "admin" && (
              <button
                onClick={() => onDelete(entry.id)}
                className="rounded px-2 py-1 text-xs text-red-400 hover:text-red-600"
              >
                삭제
              </button>
            )}
          </div>
        )}
      </div>

      {/* 세션 목록 (펼침) */}
      {expanded && (
        <div className="mt-4 border-t border-[var(--color-warm-border-light)] pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[9px] font-medium uppercase tracking-[0.25em] text-[var(--color-warm-muted)]">
              세션 기록 ({sessions.length}회)
            </h4>
            {role !== "group_leader" && entry.status === "active" && (
              <button
                onClick={() => setShowSessionForm(!showSessionForm)}
                className="rounded-lg border border-[var(--color-warm-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-warm-text)] hover:border-[var(--color-warm-text)] transition-all duration-300"
              >
                + 세션 추가
              </button>
            )}
          </div>

          {showSessionForm && (
            <form
              onSubmit={handleAddSession}
              className="mt-3 rounded-xl border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] p-3 space-y-2"
            >
              <div className="flex gap-2">
                <input
                  name="session_date"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="rounded-lg border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] px-3 py-1.5 text-sm text-[var(--color-warm-text)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/10"
                />
              </div>
              <textarea
                name="notes"
                rows={2}
                placeholder="메모 (선택)"
                className="block w-full rounded-lg border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] px-3 py-1.5 text-sm text-[var(--color-warm-text)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/10"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#1a1a1a] px-3 py-1.5 text-xs font-medium text-white transition-all duration-300 hover:bg-[#333] disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "추가"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSessionForm(false)}
                  className="rounded-lg border border-[var(--color-warm-border)] px-3 py-1.5 text-xs text-[var(--color-warm-text)] transition-all duration-300 hover:border-[var(--color-warm-text)]"
                >
                  취소
                </button>
              </div>
            </form>
          )}

          {loadingSessions ? (
            <p className="mt-3 text-xs text-[var(--color-warm-muted)]">불러오는 중...</p>
          ) : sessions.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--color-warm-muted)]">
              기록된 세션이 없습니다.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-start justify-between rounded-xl bg-[var(--color-warm-bg)] px-3 py-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--color-warm-text)]">
                        {session.session_number}회차
                      </span>
                      <span className="text-xs text-[var(--color-warm-muted)]">
                        {session.session_date}
                      </span>
                    </div>
                    {session.notes && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--color-warm-text)]/70">
                        {session.notes}
                      </p>
                    )}
                  </div>
                  {role === "admin" && (
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="text-xs text-[var(--color-warm-muted)] hover:text-red-500"
                    >
                      삭제
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 펼치기 힌트 */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs text-[var(--color-warm-muted)] hover:text-[var(--color-warm-text)] transition-all duration-300"
        >
          세션 기록 보기 ▼
        </button>
      )}
    </div>
  );
}
