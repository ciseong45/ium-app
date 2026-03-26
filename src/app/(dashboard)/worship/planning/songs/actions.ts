"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";
import type { Song } from "@/types/worship";

// ── 곡 목록 조회 ──

export async function getSongs(search?: string): Promise<(Song & { usage_count: number })[]> {
  const { supabase } = await requireAuth();

  // 곡 목록
  let query = supabase
    .from("songs")
    .select("*")
    .order("title");

  if (search && search.length > 0) {
    query = query.ilike("title", `%${search}%`);
  }

  const { data: songs, error } = await query;
  if (error || !songs) return [];

  // 사용 횟수 집계
  const { data: usageData } = await supabase
    .from("worship_conti_songs")
    .select("title");

  const usageMap = new Map<string, number>();
  (usageData || []).forEach((row: { title: string }) => {
    const count = usageMap.get(row.title) || 0;
    usageMap.set(row.title, count + 1);
  });

  return (songs as Song[]).map((song) => ({
    ...song,
    usage_count: usageMap.get(song.title) || 0,
  }));
}

// ── 곡 추가 ──

export async function addSong(
  title: string,
  artist: string | null,
  defaultKey: string | null
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase.from("songs").insert({
    title,
    artist,
    default_key: defaultKey,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "이미 등록된 곡입니다." };
    }
    return { success: false, error: "곡 추가에 실패했습니다." };
  }

  revalidatePath("/worship/planning/songs");
  return { success: true };
}

// ── 곡 수정 ──

export async function updateSong(
  songId: number,
  title: string,
  artist: string | null,
  defaultKey: string | null
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase
    .from("songs")
    .update({ title, artist, default_key: defaultKey })
    .eq("id", songId);

  if (error) return { success: false, error: "곡 수정에 실패했습니다." };

  revalidatePath("/worship/planning/songs");
  return { success: true };
}

// ── 곡 삭제 ──

export async function deleteSong(songId: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin")
    return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase.from("songs").delete().eq("id", songId);

  if (error) return { success: false, error: "곡 삭제에 실패했습니다." };

  revalidatePath("/worship/planning/songs");
  return { success: true };
}
