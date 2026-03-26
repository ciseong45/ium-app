"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";
import type { WorshipConti, ContiSong, Song, ServiceType } from "@/types/worship";

// ── 콘티 조회 ──

export async function getConti(
  serviceDate: string,
  serviceType: ServiceType = "주일"
): Promise<{ conti: WorshipConti | null; songs: ContiSong[] }> {
  const { supabase } = await requireAuth();

  const { data: conti } = await supabase
    .from("worship_contis")
    .select("*")
    .eq("service_date", serviceDate)
    .eq("service_type", serviceType)
    .single();

  if (!conti) return { conti: null, songs: [] };

  const { data: songs } = await supabase
    .from("worship_conti_songs")
    .select("*")
    .eq("conti_id", conti.id)
    .order("song_order");

  return {
    conti: conti as WorshipConti,
    songs: (songs || []) as ContiSong[],
  };
}

export async function getRecentContis(
  count: number = 12
): Promise<WorshipConti[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("worship_contis")
    .select("*, leader:members!leader_member_id(last_name, first_name)")
    .order("service_date", { ascending: false })
    .limit(count);
  if (error) return [];
  return data as WorshipConti[];
}

// ── 콘티 저장 ──

export type ContiSongDraft = {
  title: string;
  song_key: string | null;
  notes: string | null;
  bpm: number | null;
  time_signature: string | null;
  artist: string | null;
  reference_url: string | null;
  song_form: string | null;
  session_notes: string | null;
  singer_notes: string | null;
  engineer_notes: string | null;
  sheet_music_url: string | null;
};

export async function saveConti(
  serviceDate: string,
  serviceType: ServiceType,
  leaderId: number | null,
  theme: string | null,
  notes: string | null,
  scripture: string | null,
  description: string | null,
  discussionQuestions: string | null,
  songs: ContiSongDraft[]
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  // 1. upsert conti
  const { data: conti, error: contiError } = await supabase
    .from("worship_contis")
    .upsert(
      {
        service_date: serviceDate,
        service_type: serviceType,
        leader_member_id: leaderId,
        theme,
        notes,
        scripture,
        description,
        discussion_questions: discussionQuestions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "service_date,service_type" }
    )
    .select("id")
    .single();

  if (contiError || !conti)
    return { success: false, error: "콘티 저장에 실패했습니다." };

  // 2. 기존 곡 삭제 후 새로 입력
  await supabase
    .from("worship_conti_songs")
    .delete()
    .eq("conti_id", conti.id);

  if (songs.length > 0) {
    const rows = songs.map((s, i) => ({
      conti_id: conti.id,
      song_order: i + 1,
      title: s.title,
      song_key: s.song_key,
      notes: s.notes,
      bpm: s.bpm,
      time_signature: s.time_signature,
      artist: s.artist,
      reference_url: s.reference_url,
      song_form: s.song_form,
      session_notes: s.session_notes,
      singer_notes: s.singer_notes,
      engineer_notes: s.engineer_notes,
      sheet_music_url: s.sheet_music_url,
    }));

    const { error: songError } = await supabase
      .from("worship_conti_songs")
      .insert(rows);

    if (songError)
      return { success: false, error: "곡 목록 저장에 실패했습니다." };

    // 3. 곡 라이브러리에 자동 추가 (중복 무시)
    for (const s of songs) {
      await supabase
        .from("songs")
        .upsert(
          { title: s.title, artist: s.artist, default_key: s.song_key },
          { onConflict: "title,artist" }
        )
        .select()
        .maybeSingle();
    }
  }

  revalidatePath("/worship/planning/conti");
  return { success: true };
}

// ── 악보 이미지 업로드 ──

export async function uploadSheetMusic(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "파일이 없습니다." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const allowed = ["jpg", "jpeg", "png", "webp"];
  if (!allowed.includes(ext))
    return { success: false, error: "JPG, PNG, WEBP만 업로드 가능합니다." };

  if (file.size > 5 * 1024 * 1024)
    return { success: false, error: "파일 크기는 5MB 이하만 가능합니다." };

  const fileName = `sheet-music/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("conti-assets")
    .upload(fileName, file, { contentType: file.type, upsert: false });

  if (uploadError)
    return { success: false, error: `업로드 실패: ${uploadError.message}` };

  const { data: urlData } = supabase.storage
    .from("conti-assets")
    .getPublicUrl(fileName);

  return { success: true, url: urlData.publicUrl };
}

export async function deleteSheetMusic(
  url: string
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  // extract path from public URL
  const match = url.match(/conti-assets\/(.+)$/);
  if (!match) return { success: false, error: "잘못된 URL입니다." };

  const { error } = await supabase.storage
    .from("conti-assets")
    .remove([match[1]]);

  if (error)
    return { success: false, error: `삭제 실패: ${error.message}` };

  return { success: true };
}

// ── 곡 라이브러리 검색 ──

export async function searchSongs(query: string): Promise<Song[]> {
  const { supabase } = await requireAuth();
  if (!query || query.length < 1) return [];

  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .ilike("title", `%${query}%`)
    .limit(10);

  if (error) return [];
  return data as Song[];
}
