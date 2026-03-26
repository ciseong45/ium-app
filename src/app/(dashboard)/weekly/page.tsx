import { getWeeklyBrief, getRecentBriefs } from "./actions";
import WeeklyBriefView from "./WeeklyBriefView";

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + (7 - dayOfWeek));
  const defaultDate = nextSunday.toISOString().split("T")[0];
  const selectedDate = params.date || defaultDate;

  const [brief, recentBriefs] = await Promise.all([
    getWeeklyBrief(selectedDate),
    getRecentBriefs(12),
  ]);

  return (
    <WeeklyBriefView
      brief={brief}
      recentBriefs={recentBriefs}
      selectedDate={selectedDate}
    />
  );
}
