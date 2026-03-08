"use server";

import { createClient } from "@/lib/supabase/server";

export async function submitVisitorCard(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const phone = (formData.get("phone") as string) || null;
  const kakaoId = (formData.get("kakao_id") as string) || null;
  const gender = (formData.get("gender") as string) || null;
  const birthDate = (formData.get("birth_date") as string) || null;
  const baptism = (formData.get("baptism") as string) || null;
  const schoolWork = (formData.get("school_work") as string) || null;
  const previousChurch = (formData.get("previous_church") as string) || null;

  // 메모에 추가 정보 합치기
  const notesParts: string[] = [];
  if (kakaoId) notesParts.push(`카카오톡: ${kakaoId}`);
  if (baptism) notesParts.push(`세례/입교: ${baptism}`);
  if (schoolWork) notesParts.push(`학교/직장: ${schoolWork}`);
  if (previousChurch) notesParts.push(`이전 교회: ${previousChurch}`);
  const notes = notesParts.length > 0 ? notesParts.join("\n") : null;

  // 1. 멤버 등록
  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      name,
      phone,
      gender,
      birth_date: birthDate,
      status: "active",
      notes,
    })
    .select("id")
    .single();

  if (memberError) {
    return { success: false, error: "등록에 실패했습니다. 다시 시도해주세요." };
  }

  // 2. 새가족 등록
  const today = new Date().toISOString().split("T")[0];
  const { error: nfError } = await supabase.from("new_family").insert({
    member_id: member.id,
    first_visit: today,
  });

  if (nfError) {
    // 멤버는 등록됐으므로 새가족 등록 실패는 경고만
    return { success: true, warning: "멤버는 등록되었으나 새가족 등록에 실패했습니다." };
  }

  return { success: true };
}
