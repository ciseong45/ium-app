"use server";

import { createClient } from "@supabase/supabase-js";
import type { ActionResult } from "@/lib/validations";

// anon 클라이언트 — 로그인 없이 신청 가능 (visitor-card 패턴과 동일)
function createAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function submitSummerApplication(formData: FormData): Promise<ActionResult> {
  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const note = (formData.get("note") as string)?.trim() || null;
  const seasonIdRaw = formData.get("season_id") as string;

  if (!name) return { success: false, error: "이름은 필수입니다." };
  if (!seasonIdRaw) return { success: false, error: "신청 정보가 올바르지 않습니다." };

  const seasonId = parseInt(seasonIdRaw, 10);
  if (isNaN(seasonId)) return { success: false, error: "신청 정보가 올바르지 않습니다." };

  const supabase = createAnonClient();
  if (!supabase) return { success: false, error: "신청 환경이 설정되지 않았습니다." };

  const { error } = await supabase
    .from("small_group_applications")
    .insert({ season_id: seasonId, name, phone, note, source: "form" });

  if (error) return { success: false, error: "신청에 실패했습니다. 다시 시도해주세요." };
  return { success: true };
}

export async function getActiveSummerSeason(): Promise<{ id: number; name: string } | null> {
  const supabase = createAnonClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("small_group_seasons")
    .select("id, name")
    .eq("is_active", true)
    .single();
  return data ?? null;
}
