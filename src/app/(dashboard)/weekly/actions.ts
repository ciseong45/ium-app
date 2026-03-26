"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";
import type { WeeklyBrief, BriefTabKey } from "@/types/weekly";

export async function getWeeklyBrief(weekDate: string): Promise<WeeklyBrief | null> {
  const { supabase } = await requireAuth();
  const { data } = await supabase
    .from("weekly_briefs")
    .select("*")
    .eq("week_date", weekDate)
    .single();
  return data as WeeklyBrief | null;
}

export async function getRecentBriefs(count: number = 12): Promise<WeeklyBrief[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("weekly_briefs")
    .select("id, week_date, title, sermon_title, status, created_at, updated_at")
    .order("week_date", { ascending: false })
    .limit(count);
  if (error) return [];
  return data as WeeklyBrief[];
}

export async function createWeeklyBrief(
  weekDate: string,
  title: string | null,
  sermonTitle: string | null,
  sermonScripture: string | null
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase.from("weekly_briefs").insert({
    week_date: weekDate,
    title,
    sermon_title: sermonTitle,
    sermon_scripture: sermonScripture,
  });

  if (error) {
    if (error.code === "23505")
      return { success: false, error: "이미 해당 주차 자료가 존재합니다." };
    return { success: false, error: "자료 생성에 실패했습니다." };
  }

  revalidatePath("/weekly");
  return { success: true };
}

export async function updateBriefMeta(
  weekDate: string,
  title: string | null,
  sermonTitle: string | null,
  sermonScripture: string | null,
  status: string
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase
    .from("weekly_briefs")
    .update({
      title,
      sermon_title: sermonTitle,
      sermon_scripture: sermonScripture,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("week_date", weekDate);

  if (error) return { success: false, error: "수정에 실패했습니다." };

  revalidatePath("/weekly");
  return { success: true };
}

export async function updateBriefTabContent(
  weekDate: string,
  tabKey: BriefTabKey,
  content: Record<string, unknown>
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const columnMap: Record<BriefTabKey, string> = {
    common: "common_content",
    worship: "worship_content",
    media: "media_content",
    newfamily: "newfamily_content",
    smallgroup: "smallgroup_content",
  };

  const { error } = await supabase
    .from("weekly_briefs")
    .update({
      [columnMap[tabKey]]: content,
      updated_at: new Date().toISOString(),
    })
    .eq("week_date", weekDate);

  if (error) return { success: false, error: "콘텐츠 저장에 실패했습니다." };

  revalidatePath("/weekly");
  return { success: true };
}
