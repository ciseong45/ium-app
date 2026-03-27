import { getConti } from "../actions";
import { getWorshipMembers } from "../../../members/actions";
import { getLineup } from "../../lineup/actions";
import ContiView from "../ContiView";
import type { ServiceType } from "@/types/worship";

export default async function ContiEditPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string }>;
}) {
  const params = await searchParams;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + (7 - dayOfWeek));
  const defaultDate = nextSunday.toISOString().split("T")[0];
  const selectedDate = params.date || defaultDate;
  const serviceType = (params.type || "주일") as ServiceType;

  const [contiData, members, lineupData] = await Promise.all([
    getConti(selectedDate, serviceType),
    getWorshipMembers(),
    getLineup(selectedDate),
  ]);

  return (
    <ContiView
      conti={contiData.conti}
      songs={contiData.songs}
      members={members}
      selectedDate={selectedDate}
      serviceType={serviceType}
      lineupSlots={lineupData.slots}
    />
  );
}
