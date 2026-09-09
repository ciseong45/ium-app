import { addDays } from "@/lib/command-center";

export const CALENDAR_CATEGORIES = { worship: "예배", formation: "양육", community: "순·공동체", event: "행사", meeting: "회의", deadline: "마감" } as const;
export type CalendarCategory = keyof typeof CALENDAR_CATEGORIES;
export type CalendarStatus = "tentative" | "confirmed" | "cancelled";
export const CALENDAR_STATUSES = { tentative: "잠정", confirmed: "확정", cancelled: "취소" } as const;
export type SharedSchedule = {
  id: string; title: string; category: CalendarCategory; status: CalendarStatus;
  start_date: string; end_date: string | null; start_time: string | null;
  location: string | null; audience: string | null; coordinator: string | null;
  description: string | null; resource_url: string | null; service_type: string | null;
  event_id: number | null; updated_at: string; created_at: string;
};
export type DashboardNotice = { id: string; title: string; body: string; start_date: string; end_date: string; link_url: string | null; updated_at: string };
export type CalendarItem = {
  key: string; title: string; category: CalendarCategory; status: CalendarStatus | "recorded";
  date: string; endDate: string; time: string | null; location: string | null;
  audience: string | null; coordinator: string | null; description: string | null;
  links: { label: string; href: string }[]; source: string; updatedAt: string;
  editable?: SharedSchedule;
};
export type CalendarEvent = { id: number; name: string; event_type: string; start_date: string; end_date: string | null; updated_at: string };
export type CalendarConti = { id: number; service_date: string; service_type: string; updated_at: string };
export type CalendarBrief = { id: number; week_date: string; title: string | null; sermon_title: string | null; sermon_scripture: string | null; status: string; updated_at: string };
export type CalendarLineup = { id: number; service_date: string; updated_at: string };

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
}
export function weekMonday(date: string) {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}
export function calendarRange(anchor: string) {
  const start = weekMonday(anchor.slice(0, 7) + "-01");
  return { start, end: addDays(start, 41) };
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
}
export function occursOn(item: CalendarItem, date: string) { return item.date <= date && item.endDate >= date; }
export function safeLink(value: string | null): string | null {
  if (!value) return null;
  if (/^\/(?!\/)/.test(value) && !/[\\\s]/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? value : null; } catch { return null; }
}

// Only shared tables enter this projection. Personal cc_* records never enter it.
export function buildCalendar(schedules: SharedSchedule[], events: CalendarEvent[], contis: CalendarConti[], briefs: CalendarBrief[], lineups: CalendarLineup[]): CalendarItem[] {
  const items: CalendarItem[] = schedules.map(s => ({
    key: `shared:${s.id}`, title: s.title, category: s.category, status: s.status,
    date: s.start_date, endDate: s.end_date || s.start_date, time: s.start_time,
    location: s.location, audience: s.audience, coordinator: s.coordinator,
    description: s.description, links: safeLink(s.resource_url) ? [{ label: "관련 자료", href: safeLink(s.resource_url)! }] : [],
    source: "공동 사역 일정", updatedAt: s.updated_at, editable: s,
  }));
  for (const event of events) {
    const existing = items.find(i => i.editable?.event_id === event.id);
    if (existing) {
      // Linked event remains authoritative for its name and dates.
      existing.title = event.name; existing.date = event.start_date; existing.endDate = event.end_date || event.start_date;
      existing.links.push({ label: "행사 원본", href: "/events" });
      if (event.updated_at > existing.updatedAt) existing.updatedAt = event.updated_at;
    } else items.push({ key: `event:${event.id}`, title: event.name, category: "event", status: "recorded", date: event.start_date, endDate: event.end_date || event.start_date, time: null, location: null, audience: null, coordinator: null, description: null, links: [{ label: "행사 원본", href: "/events" }], source: "행사 관리", updatedAt: event.updated_at });
  }
  function worship(date: string, type: string, updated: string) {
    let item = items.find(i => i.category === "worship" && i.date === date && (i.editable?.service_type === type || i.key === `worship:${date}:${type}`));
    if (!item) {
      item = { key: `worship:${date}:${type}`, title: `${type}예배`, category: "worship", status: "recorded", date, endDate: date, time: null, location: null, audience: null, coordinator: null, description: null, links: [], source: "예배·주간 자료", updatedAt: updated };
      items.push(item);
    }
    if (updated > item.updatedAt) item.updatedAt = updated;
    return item;
  }
  for (const c of contis) worship(c.service_date, c.service_type, c.updated_at).links.push({ label: "콘티", href: `/worship/planning/conti/edit?date=${c.service_date}&type=${encodeURIComponent(c.service_type)}` });
  for (const b of briefs.filter(b => b.status === "published")) worship(b.week_date, "주일", b.updated_at).links.push({ label: "발행된 주간 자료", href: `/weekly?date=${b.week_date}` });
  for (const l of lineups) worship(l.service_date, "주일", l.updated_at).links.push({ label: "예배 담당표", href: `/worship/planning/lineup?date=${l.service_date}` });
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time || "99").localeCompare(b.time || "99") || a.title.localeCompare(b.title));
}
