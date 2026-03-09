"use server";

import { createClient } from "@/lib/supabase/server";
import { visitorCardSchema, type ActionResult } from "@/lib/validations";
import { ZodError } from "zod";

export async function submitVisitorCard(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  try {
    const data = visitorCardSchema.parse({
      name: formData.get("name"),
      phone: formData.get("phone") || null,
      kakao_id: formData.get("kakao_id") || null,
      gender: formData.get("gender") || null,
      birth_date: formData.get("birth_date") || null,
      baptism: formData.get("baptism") || null,
      school_work: formData.get("school_work") || null,
      previous_church: formData.get("previous_church") || null,
    });

    const isBaptized = data.baptism === "성인세례" || data.baptism === "입교";
    const notesParts: string[] = [];
    if (data.previous_church) notesParts.push(`이전 교회: ${data.previous_church}`);
    const notes = notesParts.length > 0 ? notesParts.join("\n") : null;

    // 1. 멤버 등록
    const { data: member, error: memberError } = await supabase
      .from("members")
      .insert({
        name: data.name,
        phone: data.phone,
        gender: data.gender,
        birth_date: data.birth_date,
        status: "active",
        kakao_id: data.kakao_id,
        is_baptized: isBaptized,
        school_or_work: data.school_work,
        notes,
      })
      .select("id")
      .single();

    if (memberError) {
      return { success: false, error: "등록에 실패했습니다. 다시 시도해주세요." };
    }

    // 2. 활성 시즌 확인
    const { data: activeSeason } = await supabase
      .from("small_group_seasons")
      .select("id")
      .eq("is_active", true)
      .single();

    // 3. 새가족 등록
    const today = new Date().toISOString().split("T")[0];
    const { error: nfError } = await supabase.from("new_family").insert({
      member_id: member.id,
      first_visit: today,
      season_id: activeSeason?.id || null,
    });

    if (nfError) {
      return { success: true, warning: "멤버는 등록되었으나 새가족 등록에 실패했습니다." };
    }

    return { success: true };
  } catch (e) {
    if (e instanceof ZodError) {
      return { success: false, error: e.issues[0].message };
    }
    return { success: false, error: "등록에 실패했습니다. 다시 시도해주세요." };
  }
}
