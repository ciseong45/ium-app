"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createEvent, deleteEvent } from "./actions";
import type { ChurchEvent } from "@/types/event";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/types/event";
import { useRole } from "@/lib/RoleContext";
import EmptyState from "@/components/ui/EmptyState";
import {
  CARD_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_LABEL_CLASS,
  BTN_PRIMARY_CLASS,
  BTN_SECONDARY_CLASS,
  INPUT_CLASS,
  SELECT_CLASS,
} from "@/components/ui/constants";

type Props = {
  events: ChurchEvent[];
};

export default function EventsView({ events }: Props) {
  const router = useRouter();
  const role = useRole();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const result = await createEvent(new FormData(e.currentTarget));
    if (result.success) {
      setShowForm(false);
      router.refresh();
    } else {
      alert(result.error);
    }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const result = await deleteEvent(id);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  // 분류: 다가올 행사 vs 지난 행사
  const today = new Date().toISOString().split("T")[0];
  const upcoming = events.filter((e) => e.start_date >= today);
  const past = events.filter((e) => e.start_date < today);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className={SECTION_LABEL_CLASS}>Events</p>
          <h1 className={PAGE_TITLE_CLASS}>행사 관리</h1>
        </div>
        {role !== "group_leader" && (
          <button
            onClick={() => setShowForm(!showForm)}
            className={BTN_PRIMARY_CLASS}
          >
            {showForm ? "취소" : "+ 새 행사"}
          </button>
        )}
      </div>

      {/* 생성 폼 */}
      {showForm && (
        <div className={`${CARD_CLASS} mb-6 p-5`}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-[var(--color-warm-secondary)]">
                  행사명
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  className={INPUT_CLASS}
                  placeholder="예: 2025 봄 수련회"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-warm-secondary)]">
                  종류
                </label>
                <select name="event_type" className={SELECT_CLASS}>
                  {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-warm-secondary)]">
                  시작일
                </label>
                <input
                  name="start_date"
                  type="date"
                  required
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-warm-secondary)]">
                  종료일
                </label>
                <input name="end_date" type="date" className={INPUT_CLASS} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-warm-secondary)]">
                설명
              </label>
              <textarea
                name="description"
                rows={3}
                className={INPUT_CLASS}
                placeholder="행사 설명..."
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={BTN_PRIMARY_CLASS}
            >
              {loading ? "등록 중..." : "행사 등록"}
            </button>
          </form>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState message="등록된 행사가 없습니다." />
      ) : (
        <div className="space-y-8">
          {/* 다가올 행사 */}
          {upcoming.length > 0 && (
            <div>
              <p className={`${SECTION_LABEL_CLASS} mb-3`}>Upcoming</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onDelete={handleDelete}
                    isAdmin={role === "admin"}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 지난 행사 */}
          {past.length > 0 && (
            <div>
              <p className={`${SECTION_LABEL_CLASS} mb-3`}>Past</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onDelete={handleDelete}
                    isAdmin={role === "admin"}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  onDelete,
  isAdmin,
  formatDate,
}: {
  event: ChurchEvent;
  onDelete: (id: number) => void;
  isAdmin: boolean;
  formatDate: (d: string) => string;
}) {
  return (
    <div className={`${CARD_CLASS} p-5`}>
      <div className="mb-3 flex items-start justify-between">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
            EVENT_TYPE_COLORS[event.event_type]
          }`}
        >
          {EVENT_TYPE_LABELS[event.event_type]}
        </span>
        {isAdmin && (
          <button
            onClick={() => onDelete(event.id)}
            className="text-xs text-[var(--color-warm-muted)] hover:text-red-500"
          >
            삭제
          </button>
        )}
      </div>
      <h3 className="mb-1 text-sm font-medium text-[var(--color-warm-text)]">
        {event.name}
      </h3>
      <p className="text-xs text-[var(--color-warm-secondary)]">
        {formatDate(event.start_date)}
        {event.end_date && ` — ${formatDate(event.end_date)}`}
      </p>
      {event.description && (
        <p className="mt-2 text-xs text-[var(--color-warm-muted)] line-clamp-2">
          {event.description}
        </p>
      )}
    </div>
  );
}
