"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";
import { fetchActiveMembers } from "@/lib/queries";
import type {
  Season,
  NewFamilyEntry,
  EducationCourse,
  EducationStatus,
} from "@/types/new-family";

export async function getSeasons() {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("small_group_seasons")
    .select("id, name, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) return [] as Season[];
  return data as Season[];
}

export async function getNewFamilies(seasonId?: number) {
  const { supabase } = await requireAuth();
  let query = supabase
    .from("new_family")
    .select(
      "*, member:members!member_id(id, last_name, first_name, phone, status), assignee:members!assigned_to(id, last_name, first_name), enrollments:new_family_enrollments(id, course_id, status, completed_at)",
    );

  if (seasonId) {
    query = query.eq("season_id", seasonId);
  }

  const { data, error } = await query;
  if (error)
    throw new Error(
      "방문·새가족 정보를 불러오지 못했습니다. 데이터베이스 업데이트와 연결 상태를 확인해주세요.",
    );

  // 이름순 정렬
  return (data as NewFamilyEntry[]).sort((a, b) =>
    `${a.member.last_name}${a.member.first_name}`.localeCompare(
      `${b.member.last_name}${b.member.first_name}`,
      "ko",
    ),
  );
}

export async function createNewFamily(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const last_name = (formData.get("last_name") as string)?.trim();
  const first_name = (formData.get("first_name") as string)?.trim();
  if (!last_name || !first_name)
    return { success: false, error: "성과 이름은 필수입니다." };

  const phone = (formData.get("phone") as string) || null;
  const firstVisit = formData.get("first_visit") as string;
  const assignedTo = formData.get("assigned_to") as string;

  if (!firstVisit) return { success: false, error: "첫 방문일은 필수입니다." };

  const { error } = await supabase.rpc("receive_new_family", {
    p_data: {
      last_name,
      first_name,
      phone,
      first_visit: firstVisit,
      assigned_to: assignedTo || null,
    },
  });
  if (error)
    return {
      success: false,
      error: "방문 등록에 실패했습니다. 활성 학기와 입력 내용을 확인해주세요.",
    };
  refreshFamilyPages();
  return { success: true };
}

// 구버전 화면의 단계 변경 요청으로 등록 상태가 바뀌지 않도록 차단한다.
export async function updateStep(
  _id: number,
  _step: number,
): Promise<ActionResult> {
  await requireAuth();
  void _id;
  void _step;
  return {
    success: false,
    error: "교육 차수를 선택해 참여·이수 상태를 기록해주세요.",
  };
}

function refreshFamilyPages() {
  for (const path of [
    "/new-family",
    "/members",
    "/",
    "/small-groups",
    "/weekly",
  ])
    revalidatePath(path);
  revalidatePath("/members/[id]", "page");
}

export async function getCourses(): Promise<EducationCourse[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("new_family_courses")
    .select("id, season_id, name, starts_on")
    .order("starts_on", { ascending: false });
  if (error) throw new Error("교육 차수를 불러오지 못했습니다.");
  return data ?? [];
}

export async function createCourse(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };
  const name = String(formData.get("name") || "").trim();
  const season_id = Number(formData.get("season_id"));
  const starts_on = String(formData.get("starts_on") || "");
  if (
    !name ||
    name.length > 80 ||
    !Number.isSafeInteger(season_id) ||
    season_id < 1 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(starts_on)
  )
    return { success: false, error: "교육 이름, 학기, 시작일을 확인해주세요." };
  const { error } = await supabase
    .from("new_family_courses")
    .insert({ name, season_id, starts_on });
  if (error)
    return {
      success: false,
      error:
        "교육 개설에 실패했습니다. 같은 학기에 동일한 이름이 있는지 확인해주세요.",
    };
  refreshFamilyPages();
  return { success: true };
}

export async function updateEducation(
  id: number,
  courseId: number,
  status: EducationStatus,
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !Number.isSafeInteger(courseId) ||
    courseId < 1 ||
    !["scheduled", "in_progress", "completed"].includes(status)
  )
    return { success: false, error: "교육 차수와 상태를 확인해주세요." };
  const { error } = await supabase.rpc("new_family_manage", {
    p_family_id: id,
    p_action: "education",
    p_course_id: courseId,
    p_status: status,
  });
  if (error)
    return {
      success: false,
      error:
        "교육 기록을 저장하지 못했습니다. 명단을 새로고침 후 확인해주세요.",
    };
  refreshFamilyPages();
  return { success: true };
}

export async function confirmRegistration(id: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };
  if (!Number.isSafeInteger(id) || id < 1)
    return { success: false, error: "대상자를 확인해주세요." };
  const { error } = await supabase.rpc("new_family_manage", {
    p_family_id: id,
    p_action: "register",
  });
  if (error)
    return {
      success: false,
      error:
        "정식 등록하지 못했습니다. 교육 이수와 현재 참여 상태를 확인해주세요.",
    };
  refreshFamilyPages();
  return { success: true };
}

export async function updateAssignee(
  id: number,
  assignedTo: number | null,
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase
    .from("new_family")
    .update({ assigned_to: assignedTo })
    .eq("id", id);
  if (error) return { success: false, error: "담당자 변경에 실패했습니다." };
  revalidatePath("/new-family");
  return { success: true };
}

export async function completeConnection(id: number): Promise<ActionResult> {
  await requireAuth();
  void id;
  return {
    success: false,
    error: "화면을 새로고침하고 정식 등록 확정 기능을 사용해주세요.",
  };
}

export async function deleteNewFamily(id: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase.from("new_family").delete().eq("id", id);
  if (error) return { success: false, error: "삭제에 실패했습니다." };
  revalidatePath("/new-family");
  return { success: true };
}

export async function restoreNewFamily(id: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };
  const { error } = await supabase.rpc("new_family_manage", {
    p_family_id: id,
    p_action: "restore",
  });
  if (error) return { success: false, error: "복귀 처리에 실패했습니다." };
  refreshFamilyPages();
  return { success: true };
}

export async function getActiveMembers() {
  const { supabase } = await requireAuth();
  return fetchActiveMembers(supabase, ["active", "attending", "adjusting"]);
}
