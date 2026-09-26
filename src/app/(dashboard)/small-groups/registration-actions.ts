"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { normalizePhone, type Campaign, type RegistrationApplication } from "@/lib/small-group-registration";
import { chapelWallToIso } from "@/lib/chapel-time";

type Result = { success: true } | { success: false; error: string };

function actionError(error: { message: string } | null, fallback: string): Result {
  if (!error) return { success: true };
  const code = ["VERSION_CONFLICT", "MATCH_CHANGED", "DUPLICATE_REVIEW_REQUIRED", "MATCH_REVIEW_REQUIRED", "GROUP_SEASON_MISMATCH", "ALREADY_CHANGED", "FORBIDDEN"]
    .find((value) => error.message.includes(value));
  const messages: Record<string, string> = {
    VERSION_CONFLICT: "다른 담당자가 먼저 변경했습니다. 목록을 새로고침해주세요.",
    MATCH_CHANGED: "성도 정보가 달라졌습니다. 다시 확인해주세요.",
    DUPLICATE_REVIEW_REQUIRED: "중복 신청이 있습니다. 먼저 확인해주세요.",
    MATCH_REVIEW_REQUIRED: "성도 연결을 확인한 뒤 확정해주세요.",
    GROUP_SEASON_MISMATCH: "대상 학기와 순이 맞지 않습니다.",
    ALREADY_CHANGED: "확정 후 순 소속이 바뀌었습니다. 현재 명단을 다시 확인해주세요.",
    FORBIDDEN: "이 모집을 처리할 권한이 없습니다.",
  };
  return { success: false, error: code ? messages[code] : fallback };
}

async function requireCampaignManager(campaignId: number) {
  const context = await requireAuth();
  if (context.role === "admin") return context;
  if (context.role !== "upper_room_leader") throw new Error("권한이 없습니다.");
  const { data, error } = await context.supabase.from("small_group_campaign_operators")
    .select("campaign_id").eq("campaign_id", campaignId).eq("profile_id", context.user.id).maybeSingle();
  if (error || !data) throw new Error("이 모집을 처리할 권한이 없습니다.");
  return context;
}

export async function getCampaignsBySeason(seasonId: number): Promise<Campaign[]> {
  const { supabase, role, user } = await requireAuth();
  if (role !== "admin" && role !== "upper_room_leader") return [];
  let allowedIds: number[] | null = null;
  if (role === "upper_room_leader") {
    const { data: operators, error: operatorError } = await supabase.from("small_group_campaign_operators")
      .select("campaign_id").eq("profile_id", user.id);
    if (operatorError) throw new Error("담당 모집을 불러오지 못했습니다.");
    allowedIds = (operators ?? []).map(o => o.campaign_id);
    if (!allowedIds.length) return [];
  }
  let query = supabase.from("small_group_campaigns")
    .select("id,season_id,slug,title,intro,audience_description,audience_mode,status,opens_at,closes_at,timezone,announcement_text,contact_text,notice_version,notice_text,retention_review_at,version")
    .eq("season_id", seasonId).order("created_at", { ascending: false });
  if (allowedIds) query = query.in("id", allowedIds);
  const { data, error } = await query;
  if (error) throw new Error("모집 목록을 불러오지 못했습니다.");
  return (data ?? []) as Campaign[];
}

export async function getOperatorSettings(seasonId: number) {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { choices: [] as { id: string; name: string }[], assigned: {} as Record<number, string[]> };
  const { data: choices, error: choicesError } = await supabase.from("profiles")
    .select("id,name").eq("role", "upper_room_leader").order("name");
  const campaigns = await getCampaignsBySeason(seasonId);
  const ids = campaigns.map(c => c.id);
  if (choicesError) throw new Error("담당자 후보를 불러오지 못했습니다.");
  if (!ids.length) return { choices: choices ?? [], assigned: {} as Record<number, string[]> };
  const { data: operators, error } = await supabase.from("small_group_campaign_operators")
    .select("campaign_id,profile_id").in("campaign_id", ids);
  if (error) throw new Error("모집 담당자를 불러오지 못했습니다.");
  const assigned: Record<number, string[]> = {};
  for (const row of operators ?? []) (assigned[row.campaign_id] ??= []).push(row.profile_id);
  return { choices: choices ?? [], assigned };
}

export async function saveCampaignOperators(campaignId: number, profileIds: string[]): Promise<Result> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase.rpc("set_group_campaign_operators", { p_campaign_id: campaignId, p_profile_ids: profileIds });
  if (!error) revalidatePath("/small-groups");
  return actionError(error, "모집 담당자를 저장하지 못했습니다.");
}

export async function getApplicationsByCampaign(campaignId: number): Promise<RegistrationApplication[]> {
  const { supabase } = await requireCampaignManager(campaignId);
  const rows: RegistrationApplication[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const { data, error } = await supabase.from("small_group_applications")
      .select("id,campaign_id,season_id,name,phone,note,corrected_name,corrected_phone,corrected_note,application_kind,status,match_status,match_reason,candidate_member_id,member_id,proposed_group_id,assigned_group_id,informed_at,version,applied_at")
      .eq("campaign_id", campaignId).order("applied_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + 499);
    if (error) throw new Error("신청 목록을 불러오지 못했습니다.");
    rows.push(...(data ?? []) as RegistrationApplication[]);
    if ((data ?? []).length < 500) return rows;
  }
  throw new Error("신청이 5,000건을 넘어 목록을 완전히 불러오지 못했습니다. 담당자에게 문의해주세요.");
}

export async function getEducationLabels(campaignId: number, applications: RegistrationApplication[]): Promise<Record<number, string>> {
  const { supabase } = await requireCampaignManager(campaignId);
  const ids = [...new Set(applications.map(a => a.member_id ?? a.candidate_member_id).filter((id): id is number => id !== null))];
  if (!ids.length) return {};
  const labels: Record<number, string> = Object.fromEntries(ids.map(id => [id, "교육 기록 없음"]));
  const seen = new Set<number>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await supabase.from("new_family")
      .select("member_id,education_progress,step,enrollments:new_family_enrollments(status,current_week,course:new_family_courses(name))")
      .in("member_id", ids.slice(offset, offset + 200));
    if (error) {
      for (const id of ids.slice(offset, offset + 200)) labels[id] = "교육 조회 오류";
      continue;
    }
    for (const row of data ?? []) {
      const enrollments = row.enrollments ?? [];
      let label = "교육 기록 없음";
      if (enrollments.length) label = enrollments.slice(0, 2).map(e => {
        const course = Array.isArray(e.course) ? e.course[0] : e.course;
        return `${course?.name || "새가족교육"} ${e.status === "completed" ? "수료" : e.status === "scheduled" ? "예정" : e.current_week ? `${e.current_week}주차` : "참여 중"}`;
      }).join(" · ");
      else if (row.education_progress === 4 || row.step === 3)
        label = "수료";
      else if (row.education_progress === 0) label = "미참여";
      else if (row.education_progress && row.education_progress > 0) label = `${row.education_progress}주차`;
      if (seen.has(row.member_id) && labels[row.member_id] !== label) labels[row.member_id] = "교육 기록 확인 필요";
      else if (!seen.has(row.member_id)) labels[row.member_id] = label;
      seen.add(row.member_id);
    }
  }
  return labels;
}

export async function saveCampaign(formData: FormData): Promise<Result> {
  const { supabase, role, user } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  const seasonId = Number(formData.get("season_id"));
  const title = String(formData.get("title") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  if (!Number.isInteger(seasonId) || !title || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug))
    return { success: false, error: "모집명과 모집 코드를 확인해주세요." };
  const openWall = String(formData.get("opens_at") || "");
  const closeWall = String(formData.get("closes_at") || "");
  const opensAt = openWall ? chapelWallToIso(openWall) : null;
  const closesAt = closeWall ? chapelWallToIso(closeWall) : null;
  if ((openWall && !opensAt) || (closeWall && !closesAt))
    return { success: false, error: "뉴욕 시간의 시작·마감을 확인해주세요. 서머타임 전환 시각은 사용할 수 없습니다." };
  const row = {
    season_id: seasonId, title, slug,
    intro: String(formData.get("intro") || "").trim(),
    audience_description: String(formData.get("audience_description") || "").trim(),
    audience_mode: formData.get("audience_mode") === "new_and_change" ? "new_and_change" : "all",
    opens_at: opensAt,
    closes_at: closesAt,
    timezone: "America/New_York",
    announcement_text: String(formData.get("announcement_text") || "").trim(),
    contact_text: String(formData.get("contact_text") || "").trim(),
    notice_text: String(formData.get("notice_text") || "").trim(),
    retention_review_at: String(formData.get("retention_review_at") || "") || null,
  };
  if (row.opens_at && row.closes_at && row.opens_at >= row.closes_at)
    return { success: false, error: "마감은 시작보다 뒤여야 합니다." };
  const id = Number(formData.get("campaign_id"));
  if (id) {
    const expectedVersion = Number(formData.get("version"));
    const { data: current } = await supabase.from("small_group_campaigns")
      .select("slug,season_id,status").eq("id", id).maybeSingle();
    if (!current || current.season_id !== seasonId) return { success: false, error: "모집 학기는 바꿀 수 없습니다." };
    if (current.status !== "draft" && current.slug !== slug) return { success: false, error: "공개된 모집 주소는 바꿀 수 없습니다." };
    const { data, error } = await supabase.from("small_group_campaigns")
      .update({ ...row, version: expectedVersion + 1, updated_at: new Date().toISOString() })
      .eq("id", id).eq("version", expectedVersion).select("id").maybeSingle();
    if (error) return { success: false, error: "모집 설정을 저장하지 못했습니다." };
    if (!data) return { success: false, error: "다른 담당자가 먼저 변경했습니다. 새로고침해주세요." };
  } else {
    const { error } = await supabase.from("small_group_campaigns").insert({ ...row, status: "draft", created_by: user.id });
    if (error) return { success: false, error: "모집을 만들지 못했습니다. 모집 코드와 입력값을 확인해주세요." };
  }
  revalidatePath(`/small-groups/${seasonId}`);
  return { success: true };
}

export async function setCampaignStatus(campaignId: number, expectedVersion: number, status: Campaign["status"]): Promise<Result> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  if (!["draft", "published", "paused", "archived"].includes(status)) return { success: false, error: "상태를 확인해주세요." };
  const { data, error } = await supabase.from("small_group_campaigns")
    .update({ status, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq("id", campaignId).eq("version", expectedVersion).select("season_id").maybeSingle();
  if (error) return { success: false, error: "상태를 바꾸지 못했습니다. 필수 안내와 기간을 확인해주세요." };
  if (!data) return { success: false, error: "다른 담당자가 먼저 변경했습니다. 새로고침해주세요." };
  revalidatePath(`/small-groups/${data.season_id}`);
  return { success: true };
}

export async function saveAssignmentDraft(id: number, version: number, groupId: number | null): Promise<Result> {
  const { supabase } = await requireAuth();
  const { error } = await supabase.rpc("draft_group_application", { p_id: id, p_version: version, p_group_id: groupId });
  if (!error) revalidatePath("/small-groups");
  return actionError(error, "배정안을 저장하지 못했습니다.");
}

export async function correctApplication(id: number, version: number, name: string, phone: string, note: string, reason: string): Promise<Result> {
  const normalizedPhone = normalizePhone(phone, "OTHER");
  if (!normalizedPhone || !name.trim() || name.trim().length > 80 || note.length > 500 || reason.trim().length < 3)
    return { success: false, error: "정정 내용과 사유를 확인해주세요. 연락처는 +국가번호 형식으로 입력해주세요." };
  const { supabase } = await requireAuth();
  const { error } = await supabase.rpc("correct_group_application", {
    p_id: id, p_version: version, p_name: name.trim(), p_phone: normalizedPhone,
    p_note: note.trim(), p_reason: reason.trim(),
  });
  if (!error) revalidatePath("/small-groups");
  return actionError(error, "신청 정정을 저장하지 못했습니다.");
}

export async function resolveApplication(id: number, version: number, memberId: number, reason: string): Promise<Result> {
  const { supabase } = await requireAuth();
  const { error } = await supabase.rpc("resolve_group_application", { p_id: id, p_version: version, p_member_id: memberId, p_reason: reason });
  if (!error) revalidatePath("/small-groups");
  return actionError(error, "성도 연결을 저장하지 못했습니다.");
}

export async function prepareNewMember(id: number, version: number, lastName: string, firstName: string, reason: string): Promise<Result> {
  const { supabase } = await requireAuth();
  const { error } = await supabase.rpc("prepare_new_group_member", {
    p_id: id, p_version: version, p_last_name: lastName.trim(), p_first_name: firstName.trim(), p_reason: reason.trim(),
  });
  if (!error) revalidatePath("/small-groups");
  return actionError(error, "새 성도 준비 정보를 저장하지 못했습니다.");
}

export async function cancelRegistration(id: number, version: number, reason: string): Promise<Result> {
  const { supabase } = await requireAuth();
  const { error } = await supabase.rpc("cancel_group_application", { p_id: id, p_version: version, p_reason: reason.trim() });
  if (!error) revalidatePath("/small-groups");
  return actionError(error, "신청을 취소하지 못했습니다.");
}

export async function markRegistrationDuplicate(id: number, version: number, representativeId: number, reason: string): Promise<Result> {
  const { supabase } = await requireAuth();
  const { error } = await supabase.rpc("duplicate_group_application", {
    p_id: id, p_version: version, p_representative_id: representativeId, p_reason: reason.trim(),
  });
  if (!error) revalidatePath("/small-groups");
  return actionError(error, "중복 신청을 표시하지 못했습니다.");
}

export async function markRegistrationInformed(id: number, version: number, method: "direct" | "phone" | "message" | "other"): Promise<Result> {
  const { supabase } = await requireAuth();
  const { error } = await supabase.rpc("mark_group_informed", { p_id: id, p_version: version, p_method: method });
  if (!error) revalidatePath("/small-groups");
  return actionError(error, "안내 여부를 저장하지 못했습니다.");
}

export async function revokeConfirmedRegistration(id: number, version: number, expectedGroupId: number,
  targetGroupId: number | null, reason: string): Promise<Result> {
  const { supabase } = await requireAuth();
  const { error } = await supabase.rpc("revoke_group_application", {
    p_id: id, p_version: version, p_expected_group_id: expectedGroupId,
    p_target_group_id: targetGroupId, p_reason: reason.trim(),
  });
  if (!error) revalidatePath("/small-groups");
  return actionError(error, "확정된 배정을 취소하지 못했습니다.");
}

export async function findMemberCandidates(campaignId: number, query: string) {
  const { supabase } = await requireCampaignManager(campaignId);
  const needle = query.trim();
  if (needle.length < 2 || needle.length > 80) return [];
  const safe = needle.replace(/[%,()]/g, "");
  const { data, error } = await supabase.from("members")
    .select("id,last_name,first_name,phone,status")
    .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,phone.ilike.%${safe}%`).limit(20);
  if (error) throw new Error("성도 후보를 찾지 못했습니다.");
  return data ?? [];
}

export async function confirmApplications(campaignId: number, operationId: string, items: { id: number; version: number }[]): Promise<Result> {
  const { supabase } = await requireAuth();
  if (items.length < 1 || items.length > 100 || !/^[0-9a-f-]{36}$/i.test(operationId))
    return { success: false, error: "1~100건을 선택해주세요." };
  const { error } = await supabase.rpc("confirm_group_applications", {
    p_campaign_id: campaignId, p_operation_id: operationId, p_items: items,
  });
  if (!error) revalidatePath("/small-groups");
  return actionError(error, "배정을 확정하지 못했습니다.");
}
