"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";
import type { WorshipLineup, WorshipLineupSlot } from "@/types/worship";

// ── 라인업 조회 ──

export async function getLineup(serviceDate: string): Promise<{
  lineup: WorshipLineup | null;
  slots: (WorshipLineupSlot & {
    member_last_name: string;
    member_first_name: string;
    position_name: string;
  })[];
}> {
  const { supabase } = await requireAuth();

  const { data: lineup } = await supabase
    .from("worship_lineups")
    .select("*")
    .eq("service_date", serviceDate)
    .single();

  if (!lineup) return { lineup: null, slots: [] };

  const { data: slots } = await supabase
    .from("worship_lineup_slots")
    .select(
      "*, members!inner(last_name, first_name), worship_positions!inner(name)"
    )
    .eq("lineup_id", lineup.id)
    .order("position_id")
    .order("slot_order");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (slots || []).map((s: any) => ({
    ...s,
    member_last_name: s.members.last_name,
    member_first_name: s.members.first_name,
    position_name: s.worship_positions.name,
  }));

  return { lineup: lineup as WorshipLineup, slots: mapped };
}

export async function getRecentLineups(
  count: number = 10
): Promise<WorshipLineup[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("worship_lineups")
    .select("*")
    .order("service_date", { ascending: false })
    .limit(count);
  if (error) return [];
  return data as WorshipLineup[];
}

// ── 라인업 저장 (upsert) ──

export async function saveLineup(
  serviceDate: string,
  comment: string | null,
  assignments: { position_id: number; member_id: number; slot_order: number }[]
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  // 1. upsert lineup
  const { data: lineup, error: lineupError } = await supabase
    .from("worship_lineups")
    .upsert(
      { service_date: serviceDate, comment, updated_at: new Date().toISOString() },
      { onConflict: "service_date" }
    )
    .select("id")
    .single();

  if (lineupError || !lineup)
    return { success: false, error: "라인업 저장에 실패했습니다." };

  // 2. 기존 슬롯 삭제 후 새로 입력
  await supabase
    .from("worship_lineup_slots")
    .delete()
    .eq("lineup_id", lineup.id);

  if (assignments.length > 0) {
    const rows = assignments.map((a) => ({
      lineup_id: lineup.id,
      position_id: a.position_id,
      member_id: a.member_id,
      slot_order: a.slot_order,
    }));

    const { error: slotError } = await supabase
      .from("worship_lineup_slots")
      .insert(rows);

    if (slotError)
      return { success: false, error: "슬롯 저장에 실패했습니다." };
  }

  revalidatePath("/worship/lineup");
  return { success: true };
}

export async function deleteLineup(serviceDate: string): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin")
    return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase
    .from("worship_lineups")
    .delete()
    .eq("service_date", serviceDate);

  if (error) return { success: false, error: "삭제에 실패했습니다." };

  revalidatePath("/worship/lineup");
  return { success: true };
}
