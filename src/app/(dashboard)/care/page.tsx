import { getCareData } from "./actions";
import CareBoard from "./CareBoard";
import { todayInTimeZone } from "@/lib/command-center";
export default async function CarePage() {
  const data = await getCareData();
  return <CareBoard {...data} today={todayInTimeZone()} />;
}
