"use server";

import { requireAuth } from "@/lib/auth";
import type { WorshipLineup, WorshipConti } from "@/types/worship";

export async function getMonthLineups(
  year: number,
  month: number
): Promise<WorshipLineup[]> {
  const { supabase } = await requireAuth();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("worship_lineups")
    .select("*")
    .gte("service_date", startDate)
    .lt("service_date", endDate)
    .order("service_date");

  if (error) return [];
  return data as WorshipLineup[];
}

export async function getMonthContis(
  year: number,
  month: number
): Promise<WorshipConti[]> {
  const { supabase } = await requireAuth();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("worship_contis")
    .select("*")
    .gte("service_date", startDate)
    .lt("service_date", endDate)
    .order("service_date");

  if (error) return [];
  return data as WorshipConti[];
}
