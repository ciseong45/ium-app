"use server";

import type { ActionResult } from "@/lib/validations";

export async function submitSummerApplication(_formData: FormData): Promise<ActionResult> {
  void _formData;
  return { success: false, error: "여름순 신청이 종료되었습니다. 새로운 순신청 페이지를 이용해주세요." };
}
