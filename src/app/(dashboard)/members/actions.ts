"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { memberSchema, type ActionResult } from "@/lib/validations";
import { STATUS_LABELS, type MemberStatus, type LeaveType, type MemberWithGroup, type MinistryTeam } from "@/types/member";
import { z, ZodError } from "zod";
import { expireAdjustingMembers, insertStatusLog, ensureNewFamilyEntry, getActiveSeason } from "@/lib/queries";
import { escapeCsvField, parseCsvLine } from "@/lib/csv";

export async function getMembers(
  search?: string,
  status?: string,
  groupId?: string,
  schoolOrWork?: string,
  birthYear?: string
) {
  const { supabase } = await requireAuth();

  let query = supabase
    .from("members")
    .select("id, last_name, first_name, phone, email, gender, birth_date, address, status, kakao_id, is_baptized, school_or_work, notes, created_at, updated_at")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (status && status !== "all") {
    // "재적" 필터: active, attending, inactive 포함
    if (status === "active") {
      query = query.in("status", ["active", "attending", "inactive"]);
    } else {
      query = query.eq("status", status);
    }
  }

  if (search) {
    const sanitized = search.replace(/[%_]/g, '\\$&');
    query = query.or(`last_name.ilike.%${sanitized}%,first_name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
  }

  if (schoolOrWork && schoolOrWork !== "all") {
    query = query.eq("school_or_work", schoolOrWork);
  }

  if (birthYear && birthYear !== "all") {
    query = query.gte("birth_date", `${birthYear}-01-01`).lte("birth_date", `${birthYear}-12-31`);
  }

  const { data, error } = await query;
  if (error) return [];

  // Lazy expiry: 적응중 상태가 3개월 지나면 자동으로 출석 전환 (batch 처리)
  const adjustingMembers = (data ?? []).filter((m: { status: string }) => m.status === "adjusting");
  if (adjustingMembers.length > 0) {
    const ids = adjustingMembers.map((m: { id: number }) => m.id);
    const expiredIds = await expireAdjustingMembers(supabase, ids);
    for (const expId of expiredIds) {
      const member = data?.find((m: { id: number }) => m.id === expId);
      if (member) member.status = "attending";
    }
  }

  if (groupId && groupId !== "all") {
    const { data: groupMembers } = await supabase
      .from("small_group_members")
      .select("member_id")
      .eq("group_id", Number(groupId));
    const memberIds = new Set((groupMembers || []).map((gm: { member_id: number }) => gm.member_id));
    return data.filter((m: { id: number }) => memberIds.has(m.id));
  }

  return data;
}

export async function getMembersWithGroups(
  search?: string,
  status?: string,
  groupId?: string,
  schoolOrWork?: string,
  birthYear?: string,
  ministryTeamId?: string
): Promise<MemberWithGroup[]> {
  const members = await getMembers(search, status, groupId, schoolOrWork, birthYear);
  if (members.length === 0) return [];

  const { supabase } = await requireAuth();

  // 순 정보
  const { data: activeSeason } = await supabase
    .from("small_group_seasons")
    .select("id")
    .eq("is_active", true)
    .single();

  let memberGroupMap = new Map<number, { group_id: number; group_name: string; leader_name: string | null; upper_room_id: number; upper_room_name: string }>();
  if (activeSeason) {
    const { data: groups } = await supabase
      .from("small_groups")
      .select("id, name, upper_room_id, leader:members!leader_id(last_name, first_name)")
      .eq("season_id", activeSeason.id);

    const { data: upperRooms } = await supabase
      .from("upper_rooms")
      .select("id, name")
      .eq("season_id", activeSeason.id);

    const { data: assignments } = await supabase
      .from("small_group_members")
      .select("member_id, group_id");

    const activeGroupIds = new Set((groups || []).map((g: { id: number }) => g.id));
    const groupMap = new Map<number, { id: number; name: string; upper_room_id: number; leader: { last_name: string; first_name: string } | null }>();
    (groups || []).forEach((g: any) => groupMap.set(g.id, g));

    const upperRoomMap = new Map<number, string>();
    (upperRooms || []).forEach((ur: any) => upperRoomMap.set(ur.id, ur.name));

    (assignments || []).forEach((a: any) => {
      if (activeGroupIds.has(a.group_id)) {
        const group = groupMap.get(a.group_id);
        if (group) {
          memberGroupMap.set(a.member_id, {
            group_id: group.id,
            group_name: group.name,
            leader_name: group.leader ? `${group.leader.last_name}${group.leader.first_name}` : null,
            upper_room_id: group.upper_room_id,
            upper_room_name: upperRoomMap.get(group.upper_room_id) || "",
          });
        }
      }
    });
  }

  // 사역팀 정보
  const memberIds = members.map((m: { id: number }) => m.id);
  const { data: mtAssignments } = await supabase
    .from("member_ministry_teams")
    .select("member_id, ministry_team:ministry_teams(id, name, category, display_order)")
    .in("member_id", memberIds);

  const memberTeamMap = new Map<number, MinistryTeam[]>();
  (mtAssignments || []).forEach((a: any) => {
    const list = memberTeamMap.get(a.member_id) || [];
    if (a.ministry_team) list.push(a.ministry_team);
    memberTeamMap.set(a.member_id, list);
  });

  let result = members.map((m: any) => ({
    ...m,
    group_info: memberGroupMap.get(m.id) || null,
    ministry_teams: memberTeamMap.get(m.id) || [],
  }));

  // 사역팀 필터 (client-side)
  if (ministryTeamId && ministryTeamId !== "all") {
    const teamId = Number(ministryTeamId);
    result = result.filter((m) =>
      m.ministry_teams?.some((t: MinistryTeam) => t.id === teamId)
    );
  }

  return result;
}

export async function getFilterOptions() {
  const { supabase } = await requireAuth();

  // 병렬 실행: 독립적인 쿼리들 동시 처리
  const [activeSeason, schoolResult, birthResult, ministryResult] = await Promise.all([
    getActiveSeason(supabase),
    supabase.from("members").select("school_or_work").not("school_or_work", "is", null).order("school_or_work"),
    supabase.from("members").select("birth_date").not("birth_date", "is", null).order("birth_date", { ascending: false }),
    supabase.from("ministry_teams").select("id, name, category, display_order").order("display_order"),
  ]);

  // 시즌 의존 쿼리: 순 + 다락방 정보
  let groups: { id: number; name: string; upper_room_name: string }[] = [];
  if (activeSeason) {
    const [groupResult, urResult] = await Promise.all([
      supabase
        .from("small_groups")
        .select("id, name, upper_room_id")
        .eq("season_id", activeSeason.id)
        .order("name"),
      supabase
        .from("upper_rooms")
        .select("id, name")
        .eq("season_id", activeSeason.id),
    ]);

    const urMap = new Map<number, string>();
    (urResult.data || []).forEach((ur: any) => urMap.set(ur.id, ur.name));

    groups = (groupResult.data || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      upper_room_name: urMap.get(g.upper_room_id) || "",
    }));
  }

  const schoolOptions = [...new Set(
    (schoolResult.data || []).map((m: { school_or_work: string | null }) => m.school_or_work).filter(Boolean)
  )] as string[];

  const birthYears = [...new Set(
    (birthResult.data || []).map((m: { birth_date: string | null }) => m.birth_date?.substring(0, 4)).filter(Boolean)
  )] as string[];

  return { groups, schoolOptions, birthYears, ministryTeams: (ministryResult.data || []) as MinistryTeam[] };
}

export async function getMemberGroupInfo(memberId: number) {
  const { supabase } = await requireAuth();

  const { data: activeSeason } = await supabase
    .from("small_group_seasons")
    .select("id")
    .eq("is_active", true)
    .single();

  if (!activeSeason) return null;

  const { data: assignment } = await supabase
    .from("small_group_members")
    .select("group_id")
    .eq("member_id", memberId);

  if (!assignment || assignment.length === 0) return null;

  const groupIds = assignment.map((a: { group_id: number }) => a.group_id);

  const { data: group } = await supabase
    .from("small_groups")
    .select("id, name, upper_room_id, leader:members!leader_id(last_name, first_name)")
    .eq("season_id", activeSeason.id)
    .in("id", groupIds)
    .single();

  if (!group) return null;

  // 다락방 이름 조회
  let upperRoomName = "";
  if (group.upper_room_id) {
    const { data: ur } = await supabase
      .from("upper_rooms")
      .select("name")
      .eq("id", group.upper_room_id)
      .single();
    upperRoomName = ur?.name || "";
  }

  return {
    group_id: group.id,
    group_name: group.name,
    leader_name: (group.leader as any) ? `${(group.leader as any).last_name}${(group.leader as any).first_name}` : null,
    upper_room_id: group.upper_room_id,
    upper_room_name: upperRoomName,
  };
}

export async function getMember(id: number) {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("members")
    .select("id, last_name, first_name, phone, email, gender, birth_date, address, status, kakao_id, is_baptized, school_or_work, notes, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  // Lazy expiry: 적응중 3개월 만료 체크 (batch 헬퍼 재사용)
  if (data.status === "adjusting") {
    const expiredIds = await expireAdjustingMembers(supabase, [id]);
    if (expiredIds.includes(id)) {
      data.status = "attending";
    }
  }

  return data;
}

export async function createMember(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  try {
    const member = memberSchema.parse({
      last_name: formData.get("last_name"),
      first_name: formData.get("first_name"),
      phone: formData.get("phone") || null,
      email: formData.get("email") || null,
      gender: formData.get("gender") || null,
      birth_date: formData.get("birth_date") || null,
      address: formData.get("address") || null,
      status: formData.get("status") || "active",
      kakao_id: formData.get("kakao_id") || null,
      is_baptized: formData.get("is_baptized") === "true",
      school_or_work: formData.get("school_or_work") || null,
      notes: formData.get("notes") || null,
    });

    const { error } = await supabase.from("members").insert(member);
    if (error) return { success: false, error: "멤버 등록에 실패했습니다." };

    revalidatePath("/members");
    return { success: true };
  } catch (e) {
    if (e instanceof ZodError) {
      return { success: false, error: e.issues[0].message };
    }
    return { success: false, error: "멤버 등록에 실패했습니다." };
  }
}

export async function updateMember(id: number, formData: FormData): Promise<ActionResult> {
  const { supabase, user, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  try {
    const member = memberSchema.parse({
      last_name: formData.get("last_name"),
      first_name: formData.get("first_name"),
      phone: formData.get("phone") || null,
      email: formData.get("email") || null,
      gender: formData.get("gender") || null,
      birth_date: formData.get("birth_date") || null,
      address: formData.get("address") || null,
      status: formData.get("status") || "active",
      kakao_id: formData.get("kakao_id") || null,
      is_baptized: formData.get("is_baptized") === "true",
      school_or_work: formData.get("school_or_work") || null,
      notes: formData.get("notes") || null,
    });

    // 현재 멤버 정보 가져오기 (상태 변경 이력용)
    const { data: current } = await supabase
      .from("members")
      .select("status")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("members")
      .update(member)
      .eq("id", id);

    if (error) return { success: false, error: "멤버 수정에 실패했습니다." };

    // 상태가 변경되었으면 이력 기록
    if (current && current.status !== member.status) {
      await insertStatusLog(supabase, id, current.status, member.status, user.id);

      // 새가족 상태로 변경 시 new_family 엔트리 자동 생성
      if (member.status === "new_family") {
        await ensureNewFamilyEntry(supabase, id);
        revalidatePath("/new-family");
      }

      // 새가족에서 다른 상태로 변경 시에도 /new-family 갱신
      if (current.status === "new_family" && member.status !== "new_family") {
        revalidatePath("/new-family");
      }

      revalidatePath("/");
    }

    revalidatePath("/members");
    revalidatePath(`/members/${id}`);
    return { success: true };
  } catch (e) {
    if (e instanceof ZodError) {
      return { success: false, error: e.issues[0].message };
    }
    return { success: false, error: "멤버 수정에 실패했습니다." };
  }
}

export async function deleteMember(id: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) return { success: false, error: "멤버 삭제에 실패했습니다." };

  revalidatePath("/members");
  revalidatePath("/");
  revalidatePath("/new-family");
  revalidatePath("/attendance");
  return { success: true };
}

export async function deleteMembers(ids: number[]): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  if (ids.length === 0) return { success: false, error: "삭제할 멤버가 없습니다." };

  const { error } = await supabase.from("members").delete().in("id", ids);
  if (error) return { success: false, error: "멤버 삭제에 실패했습니다." };

  revalidatePath("/members");
  revalidatePath("/");
  revalidatePath("/new-family");
  revalidatePath("/attendance");
  revalidatePath("/one-to-one");
  revalidatePath("/small-groups");
  return { success: true };
}

export async function moveMembersToGroup(
  memberIds: number[],
  targetGroupId: number | null
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };
  if (memberIds.length === 0) return { success: false, error: "선택한 멤버가 없습니다." };

  // 활성 시즌의 그룹 ID 목록 조회
  const { data: activeSeason } = await supabase
    .from("small_group_seasons")
    .select("id")
    .eq("is_active", true)
    .single();

  if (!activeSeason) return { success: false, error: "활성 시즌이 없습니다." };

  const { data: seasonGroups } = await supabase
    .from("small_groups")
    .select("id")
    .eq("season_id", activeSeason.id);

  const seasonGroupIds = (seasonGroups || []).map((g: { id: number }) => g.id);
  if (seasonGroupIds.length === 0) return { success: false, error: "활성 시즌에 순이 없습니다." };

  // 기존 배정 삭제 (활성 시즌 순만)
  const { error: deleteError } = await supabase
    .from("small_group_members")
    .delete()
    .in("member_id", memberIds)
    .in("group_id", seasonGroupIds);

  if (deleteError) return { success: false, error: "기존 순 배정 해제에 실패했습니다." };

  // targetGroupId가 null이면 배정 해제만
  if (targetGroupId === null) {
    revalidatePath("/members");
    revalidatePath("/small-groups");
    return { success: true };
  }

  // 새 그룹에 배정
  const rows = memberIds.map((memberId) => ({
    group_id: targetGroupId,
    member_id: memberId,
  }));

  const { error: insertError } = await supabase
    .from("small_group_members")
    .insert(rows);

  if (insertError) return { success: false, error: "순 배정에 실패했습니다." };

  revalidatePath("/members");
  revalidatePath("/small-groups");
  return { success: true };
}

export async function getStatusLog(memberId: number) {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("member_status_log")
    .select("*, profiles(name)")
    .eq("member_id", memberId)
    .order("changed_at", { ascending: false });

  if (error) return [];
  return data;
}

// ===== 휴적 관리 =====

export async function getMemberLeaves(memberId: number) {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("member_leaves")
    .select("id, member_id, leave_type, reason, start_date, expected_return, actual_return, created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data;
}

export async function startLeave(
  memberId: number,
  leaveType: LeaveType,
  reason: string | null,
  startDate: string,
  expectedReturn: string | null
): Promise<ActionResult> {
  const { supabase, user, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  // 현재 멤버 상태 확인
  const { data: member } = await supabase
    .from("members")
    .select("status")
    .eq("id", memberId)
    .single();

  if (!member) return { success: false, error: "멤버를 찾을 수 없습니다." };

  // 휴적 기록 생성
  const { error: leaveError } = await supabase.from("member_leaves").insert({
    member_id: memberId,
    leave_type: leaveType,
    reason,
    start_date: startDate,
    expected_return: expectedReturn || null,
  });
  if (leaveError) return { success: false, error: "휴적 등록에 실패했습니다." };

  // 멤버 상태를 on_leave로 변경
  const { error: updateError } = await supabase
    .from("members")
    .update({ status: "on_leave" as MemberStatus })
    .eq("id", memberId);
  if (updateError) return { success: false, error: "상태 변경에 실패했습니다." };

  // 상태 변경 이력 기록
  await insertStatusLog(supabase, memberId, member.status, "on_leave", user.id);

  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/");
  return { success: true };
}

// ===== 인라인 편집 =====

export async function quickUpdateField(
  memberId: number,
  field: "gender" | "status" | "school_or_work",
  value: string | null
): Promise<ActionResult> {
  const { supabase, user, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  if (field === "gender" && value !== null && value !== "M" && value !== "F") {
    return { success: false, error: "잘못된 성별 값입니다." };
  }

  const validStatuses = ["active", "attending", "inactive", "removed", "on_leave", "new_family", "adjusting"];
  if (field === "status" && value !== null && !validStatuses.includes(value)) {
    return { success: false, error: "잘못된 상태 값입니다." };
  }

  if (field === "school_or_work" && value !== null && value.length > 100) {
    return { success: false, error: "학교/직장명이 너무 깁니다." };
  }

  // 상태 변경 시 이력 기록 + 새가족 연동
  if (field === "status") {
    const { data: current } = await supabase
      .from("members")
      .select("status")
      .eq("id", memberId)
      .single();

    if (current && value && current.status !== value) {
      await insertStatusLog(supabase, memberId, current.status, value, user.id);

      // 새가족 상태로 변경 시 new_family 엔트리 자동 생성
      if (value === "new_family") {
        await ensureNewFamilyEntry(supabase, memberId);
        revalidatePath("/new-family");
      }

      // 새가족에서 다른 상태로 변경 시에도 /new-family 갱신
      if (current.status === "new_family" && value !== "new_family") {
        revalidatePath("/new-family");
      }

      revalidatePath("/");
    }
  }

  const { error } = await supabase
    .from("members")
    .update({ [field]: value })
    .eq("id", memberId);

  if (error) return { success: false, error: "수정에 실패했습니다." };

  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  return { success: true };
}

export async function updateMemberMinistryTeams(
  memberId: number,
  teamIds: number[]
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  const { error: deleteError } = await supabase
    .from("member_ministry_teams")
    .delete()
    .eq("member_id", memberId);

  if (deleteError) return { success: false, error: "사역팀 수정에 실패했습니다." };

  if (teamIds.length > 0) {
    const rows = teamIds.map((teamId) => ({
      member_id: memberId,
      ministry_team_id: teamId,
    }));
    const { error: insertError } = await supabase
      .from("member_ministry_teams")
      .insert(rows);
    if (insertError) return { success: false, error: "사역팀 등록에 실패했습니다." };
  }

  revalidatePath("/members");
  return { success: true };
}

// ===== CSV 내보내기/가져오기 =====

const CSV_HEADERS = ["성", "이름", "전화번호", "이메일", "성별", "생년월일", "주소", "상태", "카카오톡ID", "세례입교", "학교/직장", "메모"] as const;

const GENDER_KR: Record<string, string> = { M: "남", F: "여" };
const GENDER_EN: Record<string, string> = { 남: "M", 여: "F" };

// STATUS_LABELS에서 파생: 한글 → 영문 매핑
const STATUS_LABEL_TO_EN: Record<string, MemberStatus> = Object.fromEntries(
  Object.entries(STATUS_LABELS).map(([k, v]) => [v, k as MemberStatus])
) as Record<string, MemberStatus>;

// STATUS_LABELS 그대로 사용 (영문 → 한글)
const STATUS_EN_TO_KR = STATUS_LABELS;


export async function exportMembersCSV(): Promise<{ success: true; csv: string } | { success: false; error: string }> {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("members")
    .select("last_name, first_name, phone, email, gender, birth_date, address, status, kakao_id, is_baptized, school_or_work, notes")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) return { success: false, error: "멤버 목록을 불러오지 못했습니다." };

  const header = CSV_HEADERS.join(",");
  const rows = (data ?? []).map((m) => {
    return [
      escapeCsvField(m.last_name ?? ""),
      escapeCsvField(m.first_name ?? ""),
      escapeCsvField(m.phone ?? ""),
      escapeCsvField(m.email ?? ""),
      m.gender ? (GENDER_KR[m.gender] ?? "") : "",
      m.birth_date ?? "",
      escapeCsvField(m.address ?? ""),
      STATUS_EN_TO_KR[m.status as MemberStatus] ?? m.status ?? "",
      escapeCsvField(m.kakao_id ?? ""),
      m.is_baptized ? "O" : "X",
      escapeCsvField(m.school_or_work ?? ""),
      escapeCsvField(m.notes ?? ""),
    ].join(",");
  });

  return { success: true, csv: "\uFEFF" + [header, ...rows].join("\n") };
}

export type ImportRow = {
  row: number;
  last_name: string;
  first_name: string;
  error?: string;
};

export async function importMembersCSV(
  csvText: string
): Promise<{ success: true; imported: number; skipped: ImportRow[] } | { success: false; error: string }> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { success: false, error: "CSV 파일에 데이터가 없습니다." };

  // BOM 제거
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCsvLine(headerLine);

  // 헤더 매핑 — 한국어/영어 모두 지원
  const headerMap: Record<string, number> = {};
  const HEADER_ALIASES: Record<string, string> = {
    성: "last_name", last_name: "last_name",
    이름: "first_name", first_name: "first_name",
    전화번호: "phone", phone: "phone",
    이메일: "email", email: "email",
    성별: "gender", gender: "gender",
    생년월일: "birth_date", birth_date: "birth_date",
    주소: "address", address: "address",
    상태: "status", status: "status",
    카카오톡id: "kakao_id", kakao_id: "kakao_id", "카카오톡ID": "kakao_id",
    세례입교: "is_baptized", is_baptized: "is_baptized",
    "학교/직장": "school_or_work", school_or_work: "school_or_work",
    메모: "notes", notes: "notes",
  };

  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[h.toLowerCase().trim()];
    if (key) headerMap[key] = i;
  });

  if (headerMap["last_name"] === undefined || headerMap["first_name"] === undefined) {
    return { success: false, error: "CSV에 '성'과 '이름' 열이 필요합니다." };
  }

  const toInsert: Record<string, unknown>[] = [];
  const skipped: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const last_name = fields[headerMap["last_name"]] ?? "";
    const first_name = fields[headerMap["first_name"]] ?? "";

    if (!last_name || !first_name) {
      skipped.push({ row: i + 1, last_name: last_name || "(빈 성)", first_name: first_name || "(빈 이름)", error: "성과 이름은 필수입니다." });
      continue;
    }

    const genderRaw = headerMap["gender"] !== undefined ? fields[headerMap["gender"]] ?? "" : "";
    const statusRaw = headerMap["status"] !== undefined ? fields[headerMap["status"]] ?? "" : "";

    const gender = GENDER_EN[genderRaw] ?? (["M", "F"].includes(genderRaw) ? genderRaw : null);
    const status = STATUS_LABEL_TO_EN[statusRaw] ??
      (["active", "attending", "inactive", "removed", "on_leave", "new_family", "adjusting"].includes(statusRaw) ? statusRaw : "active");

    const emailRaw = headerMap["email"] !== undefined ? fields[headerMap["email"]] ?? "" : "";
    if (emailRaw && !z.string().email().safeParse(emailRaw).success) {
      skipped.push({ row: i + 1, last_name, first_name, error: "이메일 형식이 올바르지 않습니다." });
      continue;
    }

    toInsert.push({
      last_name,
      first_name,
      phone: headerMap["phone"] !== undefined ? fields[headerMap["phone"]] || null : null,
      email: emailRaw || null,
      gender: gender || null,
      birth_date: headerMap["birth_date"] !== undefined ? fields[headerMap["birth_date"]] || null : null,
      address: headerMap["address"] !== undefined ? fields[headerMap["address"]] || null : null,
      status,
      kakao_id: headerMap["kakao_id"] !== undefined ? fields[headerMap["kakao_id"]] || null : null,
      is_baptized: headerMap["is_baptized"] !== undefined
        ? ["O", "예", "true", "Y"].includes((fields[headerMap["is_baptized"]] ?? "").trim())
        : false,
      school_or_work: headerMap["school_or_work"] !== undefined ? fields[headerMap["school_or_work"]] || null : null,
      notes: headerMap["notes"] !== undefined ? fields[headerMap["notes"]] || null : null,
    });
  }

  if (toInsert.length === 0) {
    return { success: false, error: "가져올 유효한 데이터가 없습니다." };
  }

  // 50개씩 배치 삽입
  const BATCH = 50;
  let imported = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error: insertError } = await supabase.from("members").insert(batch);
    if (insertError) {
      console.error("CSV import batch insert failed:", insertError.message);
      return {
        success: false,
        error: `${imported}건 삽입 후 오류가 발생했습니다.`,
      };
    }
    imported += batch.length;
  }

  revalidatePath("/members");
  return { success: true, imported, skipped };
}

export async function downloadCSVTemplate(): Promise<string> {
  return "\uFEFF" + CSV_HEADERS.join(",") + "\n홍,길동,010-1234-5678,hong@email.com,남,1995-03-15,서울시 강남구,출석,hong_kakao,O,한국대학교,";
}

export async function getMemberMinistryTeams(memberId: number) {
  const { supabase } = await requireAuth();
  const { data } = await supabase
    .from("member_ministry_teams")
    .select("ministry_team:ministry_teams(id, name, category, display_order)")
    .eq("member_id", memberId);
  if (!data) return [];
  return data.map((d: any) => d.ministry_team).filter(Boolean) as MinistryTeam[];
}

export async function getNewFamilyEntry(memberId: number) {
  const { supabase } = await requireAuth();
  const { data } = await supabase
    .from("new_family")
    .select("step, step_updated_at")
    .eq("member_id", memberId)
    .single();
  return data;
}

export async function returnFromLeave(memberId: number, leaveId: number): Promise<ActionResult> {
  const { supabase, user, role } = await requireAuth();
  if (role === "group_leader") return { success: false, error: "권한이 없습니다." };

  // 휴적 기록에 복귀일 기록
  const { error: leaveError } = await supabase
    .from("member_leaves")
    .update({ actual_return: new Date().toISOString().split("T")[0] })
    .eq("id", leaveId);
  if (leaveError) return { success: false, error: "복귀 처리에 실패했습니다." };

  // 멤버 상태를 attending으로 복귀
  const { error: updateError } = await supabase
    .from("members")
    .update({ status: "attending" as MemberStatus })
    .eq("id", memberId);
  if (updateError) return { success: false, error: "상태 변경에 실패했습니다." };

  // 상태 변경 이력 기록
  await insertStatusLog(supabase, memberId, "on_leave", "attending", user.id);

  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/");
  return { success: true };
}
