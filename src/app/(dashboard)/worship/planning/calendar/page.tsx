import { getMonthLineups, getMonthContis } from "./actions";
import WorshipCalendarView from "./WorshipCalendarView";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const [lineups, contis] = await Promise.all([
    getMonthLineups(year, month),
    getMonthContis(year, month),
  ]);

  return (
    <WorshipCalendarView
      year={year}
      month={month}
      lineups={lineups}
      contis={contis}
    />
  );
}
