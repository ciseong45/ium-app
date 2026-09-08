import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { todayInTimeZone } from "@/lib/command-center";
import { getCommandCenterData } from "./actions";
import CommandCenterView from "./CommandCenterView";

export default async function CommandCenterPage() {
  const { role } = await requireAuth();
  if (role !== "admin") redirect("/");

  const data = await getCommandCenterData();
  return <CommandCenterView data={data} today={todayInTimeZone()} />;
}
