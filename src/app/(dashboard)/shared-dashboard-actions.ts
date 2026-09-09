"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { addDays } from "@/lib/command-center";
import { buildCalendar, calendarRange, CALENDAR_CATEGORIES, safeLink, validDate } from "@/lib/shared-calendar";
import type { SharedSchedule, DashboardNotice, CalendarBrief, CalendarEvent } from "@/lib/shared-calendar";
import type { ActionResult } from "@/lib/validations";

export async function getSharedDashboard(today: string, anchor: string) {
  const { supabase } = await requireAuth();
  if (!validDate(today) || !validDate(anchor)) throw new Error("유효하지 않은 날짜입니다.");
  const { start, end } = calendarRange(anchor);
  const [schedules, events, contis, briefs, lineups, notices, deadlines, currentBriefs, currentLineups, currentContis] = await Promise.all([
    supabase.from("ministry_calendar").select("id,title,category,status,start_date,end_date,start_time,location,audience,coordinator,description,resource_url,service_type,event_id,updated_at,created_at").is("archived_at", null).lte("start_date", end).or(`end_date.gte.${start},and(end_date.is.null,start_date.gte.${start})`),
    supabase.from("events").select("id,name,event_type,start_date,end_date,updated_at").lte("start_date", end).or(`end_date.gte.${start},and(end_date.is.null,start_date.gte.${start})`),
    supabase.from("worship_contis").select("id,service_date,service_type,updated_at").gte("service_date", start).lte("service_date", end),
    supabase.from("weekly_briefs").select("id,week_date,title,sermon_title,sermon_scripture,status,updated_at").eq("status", "published").gte("week_date", start).lte("week_date", end),
    supabase.from("worship_lineups").select("id,service_date,updated_at").gte("service_date", start).lte("service_date", end),
    supabase.from("dashboard_notices").select("id,title,body,start_date,end_date,link_url,updated_at").is("archived_at", null).lte("start_date", today).gte("end_date", today).order("updated_at", { ascending: false }),
    supabase.from("ministry_calendar").select("id,title,category,status,start_date,end_date,start_time,location,audience,coordinator,description,resource_url,service_type,event_id,updated_at,created_at").eq("category", "deadline").neq("status", "cancelled").is("archived_at", null).gte("start_date", today).lte("start_date", addDays(today, 28)).order("start_date"),
    supabase.from("weekly_briefs").select("id,week_date,title,sermon_title,sermon_scripture,status,updated_at").eq("status", "published").gte("week_date", today).lte("week_date", addDays(today, 6)).order("week_date"),
    supabase.from("worship_lineups").select("id,service_date,updated_at").gte("service_date", today).lte("service_date", addDays(today, 6)),
    supabase.from("worship_contis").select("id,service_date,service_type,updated_at").gte("service_date", today).lte("service_date", addDays(today, 6)),
  ]);
  const errors = [
    [schedules.error, "공동 일정"], [events.error, "행사"], [contis.error, "콘티"],
    [briefs.error, "주간 자료"], [lineups.error, "담당표"], [notices.error, "공지"],
    [deadlines.error, "마감"], [currentBriefs.error || currentLineups.error || currentContis.error, "이번 주 자료"],
  ].filter(([error]) => error).map(([, label]) => String(label));
  // Fetch explicit event links even after the event's date moves across a month boundary.
  let shared = (schedules.data ?? []) as SharedSchedule[];
  const visibleEvents = (events.data ?? []) as CalendarEvent[];
  const eventIds = visibleEvents.map(e => e.id);
  if (eventIds.length) {
    const linked = await supabase.from("ministry_calendar").select("id,title,category,status,start_date,end_date,start_time,location,audience,coordinator,description,resource_url,service_type,event_id,updated_at,created_at").in("event_id", eventIds).is("archived_at", null);
    if (linked.error) errors.push("행사 연결");
    else shared = [...new Map([...shared, ...(linked.data ?? []) as SharedSchedule[]].map(s => [s.id, s])).values()];
  }
  const missingEventIds = shared.map(s => s.event_id).filter((id): id is number => id !== null && !eventIds.includes(id));
  if (missingEventIds.length) {
    const linked = await supabase.from("events").select("id,name,event_type,start_date,end_date,updated_at").in("id", missingEventIds);
    if (linked.error) errors.push("행사 원본");
    else visibleEvents.push(...(linked.data ?? []));
  }
  return {
    items: buildCalendar(shared, visibleEvents, contis.data ?? [], (briefs.data ?? []) as CalendarBrief[], lineups.data ?? []).filter(i => i.date <= end && i.endDate >= start),
    notices: (notices.data ?? []) as DashboardNotice[],
    deadlines: buildCalendar((deadlines.data ?? []) as SharedSchedule[], [], [], [], []),
    resources: buildCalendar([], [], currentContis.data ?? [], (currentBriefs.data ?? []) as CalendarBrief[], currentLineups.data ?? []),
    currentBrief: (currentBriefs.data?.[0] ?? null) as CalendarBrief | null,
    errors,
  };
}

function textValue(form: FormData, key: string) { return String(form.get(key) ?? "").trim(); }
const denied: ActionResult = { success: false, error: "공동 일정과 공지는 관리자만 변경할 수 있습니다." };

export async function saveSharedSchedule(form: FormData): Promise<ActionResult> {
  const { supabase, role, user } = await requireAuth();
  if (role !== "admin") return denied;
  const title = textValue(form, "title"), category = textValue(form, "category"), status = textValue(form, "status");
  const start = textValue(form, "start_date"), end = textValue(form, "end_date"), time = textValue(form, "start_time");
  const resource = textValue(form, "resource_url"), serviceType = textValue(form, "service_type");
  if (!title || title.length > 180 || !Object.hasOwn(CALENDAR_CATEGORIES, category) || !["tentative", "confirmed", "cancelled"].includes(status)) return { success: false, error: "일정 제목·종류·상태를 확인해주세요." };
  if (!validDate(start) || (end && (!validDate(end) || end < start))) return { success: false, error: "시작일과 종료일을 확인해주세요." };
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { success: false, error: "시간을 확인해주세요." };
  if (resource && !safeLink(resource)) return { success: false, error: "자료 주소는 웹 주소로 입력해주세요." };
  if (category === "worship" && !["주일", "금요", "수련회", "특별", "기타"].includes(serviceType)) return { success: false, error: "예배 종류를 선택해주세요." };
  const id = textValue(form, "id");
  const values = { title, category, status, start_date: start, end_date: end || null, start_time: time || null, location: textValue(form, "location") || null, audience: textValue(form, "audience") || null, coordinator: textValue(form, "coordinator") || null, description: textValue(form, "description") || null, resource_url: resource || null, service_type: category === "worship" ? serviceType : null };
  if (id) {
    const existing = await supabase.from("ministry_calendar").select("id,event_id").eq("id", id).is("archived_at", null).maybeSingle();
    if (existing.error || !existing.data) return { success: false, error: "변경할 일정을 찾을 수 없습니다." };
    if (existing.data.event_id) return { success: false, error: "행사에 연결된 일정은 행사 관리에서 수정해주세요." };
  }
  const result = id ? await supabase.from("ministry_calendar").update(values).eq("id", id).select("id").single() : await supabase.from("ministry_calendar").insert({ ...values, created_by: user.id });
  if (result.error) return { success: false, error: "일정을 저장하지 못했습니다." };
  revalidatePath("/"); return { success: true };
}

export async function saveDashboardNotice(form: FormData): Promise<ActionResult> {
  const { supabase, role, user } = await requireAuth();
  if (role !== "admin") return denied;
  const title = textValue(form, "title"), body = textValue(form, "body"), start = textValue(form, "start_date"), end = textValue(form, "end_date"), url = textValue(form, "link_url");
  if (!title || title.length > 180 || !body || body.length > 3000 || !validDate(start) || !validDate(end) || end < start) return { success: false, error: "공지 내용과 표시 기간을 확인해주세요." };
  if (url && !safeLink(url)) return { success: false, error: "유효한 웹 주소를 입력해주세요." };
  const id = textValue(form, "id");
  const values = { title, body, start_date: start, end_date: end, link_url: url || null };
  const result = id ? await supabase.from("dashboard_notices").update(values).eq("id", id).select("id").single() : await supabase.from("dashboard_notices").insert({ ...values, created_by: user.id });
  if (result.error) return { success: false, error: "공지를 저장하지 못했습니다." };
  revalidatePath("/"); return { success: true };
}
