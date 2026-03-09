"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { memberSchema, type ActionResult } from "@/lib/validations";
import type { MemberStatus, LeaveType, MemberWithGroup } from "@/types/member";
import { ZodError } from "zod";

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
    .select("*")
    .order("name", { ascending: true });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  if (schoolOrWork && schoolOrWork !== "all") {
    query = query.eq("school_or_work", schoolOrWork);
  }

  if (birthYear && birthYear !== "all") {
    query = query.gte("birth_date", `${birthYear}-01-01`).lte("birth_date", `${birthYear}-12-31`);
  }

  const { data, error } = await query;
  if (error) return [];

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
  birthYear?: string
): Promise<MemberWithGroup[]> {
  const members = await getMembers(search, status, groupId, schoolOrWork, birthYear);
  if (members.length === 0) return [];

  const { supabase } = await requireAuth();

  const { data: activeSeason } = await supabase
    .from("small_group_seasons")
    .select("id")
    .eq("is_active", true)
    .single();

  if (!activeSeason) return members.map((m) => ({ ...m, group_info: null }));

  const { data: groups } = await supabase
    .from("small_groups")
    .select("id, name, leader:members!leader_id(name)")
    .eq("season_id", activeSeason.id);

  const { data: assignments } = await supabase
    .from("small_group_members")
    .select("member_id, group_id");

  const activeGroupIds = new Set((groups || []).map((g: { id: number }) => g.id));
  const groupMap = new Map<number, { id: number; name: string; leader: { name: string } | null }>();
  (groups || []).forEach((g: any) => groupMap.set(g.id, g));

  const memberGroupMap = new Map<number, { group_id: number; group_name: string; leader_name: string | null }>();
  (assignments || []).forEach((a: any) => {
    if (activeGroupIds.has(a.group_id)) {
      const group = groupMap.get(a.group_id);
      if (group) {
        memberGroupMap.set(a.member_id, {
          group_id: group.id,
          group_name: group.name,
          leader_name: group.leader?.name || null,
        });
      }
    }
  });

  return members.map((m) => ({
    ...m,
    group_info: memberGroupMap.get(m.id) || null,
  }));
}

export async function getFilterOptions() {
  const { supabase } = await requireAuth();

  const { data: activeSeason } = await supabase
    .from("small_group_seasons")
    .select("id")
    .eq("is_active", true)
    .single();

  let groups: { id: number; name: string }[] = [];
  if (activeSeason) {
    const { data } = await supabase
      .from("small_groups")
      .select("id, name")
      .eq("season_id", activeSeason.id)
      .order("name");
    groups = data || [];
  }

  const { data: schoolData } = await supabase
    .from("members")
    .select("school_or_work")
    .not("school_or_work", "is", null)
    .order("school_or_work");

  const schoolOptions = [...new Set(
    (schoolData || []).map((m: { school_or_work: string | null }) => m.school_or_work).filter(Boolean)
  )] as string[];

  const { data: birthData } = await supabase
    .from("members")
    .select("birth_date")
    .not("birth_date", "is", null)
    .order("birth_date", { ascending: false });

  const birthYears = [...new Set(
    (birthData || []).map((m: { birth_date: string | null }) => m.birth_date?.substring(0, 4)).filter(Boolean)
  )] as string[];

  return { groups, schoolOptions, birthYears };
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
    .select("id, name, leader:members!leader_id(name)")
    .eq("season_id", activeSeason.id)
    .in("id", groupIds)
    .single();

  if (!group) return null;

  return {
    group_id: group.id,
    group_name: group.name,
    leader_name: (group.leader as any)?.name || null,
  };
}

export async function getMember(id: number) {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export async function createMember(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "viewer") return { success: false, error: "권한이 없습니다." };

  try {
    const member = memberSchema.parse({
      name: formData.get("name"),
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
  if (role === "viewer") return { success: false, error: "권한이 없습니다." };

  try {
    const member = memberSchema.parse({
      name: formData.get("name"),
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
      await supabase.from("member_status_log").insert({
        member_id: id,
        old_status: current.status,
        new_status: member.status,
        changed_by: user.id,
      });
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
  return { success: true };
}

export async function deleteMembers(ids: number[]): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  if (ids.length === 0) return { success: false, error: "삭제할 멤버가 없습니다." };

  const { error } = await supabase.from("members").delete().in("id", ids);
  if (error) return { success: false, error: "멤버 삭제에 실패했습니다." };

  revalidatePath("/members");
  return { success: true };
}

export async function moveMembersToGroup(
  memberIds: number[],
  targetGroupId: number | null
): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "viewer") return { success: false, error: "권한이 없습니다." };
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
  if (seasonGroupIds.length === 0) return { success: false, error: "활성 시즌에 소그룹이 없습니다." };

  // 기존 배정 삭제 (활성 시즌 소그룹만)
  const { error: deleteError } = await supabase
    .from("small_group_members")
    .delete()
    .in("member_id", memberIds)
    .in("group_id", seasonGroupIds);

  if (deleteError) return { success: false, error: "기존 소그룹 배정 해제에 실패했습니다." };

  // targetGroupId가 null이면 배정 해제만
  if (targetGroupId === null) {
    revalidatePath("/members");
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

  if (insertError) return { success: false, error: "소그룹 배정에 실패했습니다." };

  revalidatePath("/members");
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
    .select("*")
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
  if (role === "viewer") return { success: false, error: "권한이 없습니다." };

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
  await supabase.from("member_status_log").insert({
    member_id: memberId,
    old_status: member.status,
    new_status: "on_leave",
    changed_by: user.id,
  });

  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  return { success: true };
}

// ===== CSV 내보내기/가져오기 =====

const CSV_HEADERS = ["이름", "전화번호", "이메일", "성별", "생년월일", "주소", "상태", "카카오톡ID", "세례입교", "학교/직장", "메모"] as const;

const GENDER_KR: Record<string, string> = { M: "남", F: "여" };
const GENDER_EN: Record<string, string> = { 남: "M", 여: "F" };

const STATUS_LABEL_TO_EN: Record<string, MemberStatus> = {
  재적: "active",
  출석: "attending",
  미출석: "inactive",
  제적: "removed",
  휴적: "on_leave",
};

const STATUS_EN_TO_KR: Record<MemberStatus, string> = {
  active: "재적",
  attending: "출석",
  inactive: "미출석",
  removed: "제적",
  on_leave: "휴적",
};

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export async function exportMembersCSV(): Promise<{ success: true; csv: string } | { success: false; error: string }> {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("members")
    .select("name, phone, email, gender, birth_date, address, status, kakao_id, is_baptized, school_or_work, notes")
    .order("name", { ascending: true });

  if (error) return { success: false, error: "멤버 목록을 불러오지 못했습니다." };

  const header = CSV_HEADERS.join(",");
  const rows = (data ?? []).map((m) => {
    return [
      escapeCsvField(m.name ?? ""),
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
  name: string;
  error?: string;
};

export async function importMembersCSV(
  csvText: string
): Promise<{ success: true; imported: number; skipped: ImportRow[] } | { success: false; error: string }> {
  const { supabase, role } = await requireAuth();
  if (role === "viewer") return { success: false, error: "권한이 없습니다." };

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { success: false, error: "CSV 파일에 데이터가 없습니다." };

  // BOM 제거
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCsvLine(headerLine);

  // 헤더 매핑 — 한국어/영어 모두 지원
  const headerMap: Record<string, number> = {};
  const HEADER_ALIASES: Record<string, string> = {
    이름: "name", name: "name",
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

  if (headerMap["name"] === undefined) {
    return { success: false, error: "CSV에 '이름' 열이 없습니다." };
  }

  const toInsert: Record<string, unknown>[] = [];
  const skipped: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const name = fields[headerMap["name"]] ?? "";

    if (!name) {
      skipped.push({ row: i + 1, name: "(빈 이름)", error: "이름이 비어있습니다." });
      continue;
    }

    const genderRaw = headerMap["gender"] !== undefined ? fields[headerMap["gender"]] ?? "" : "";
    const statusRaw = headerMap["status"] !== undefined ? fields[headerMap["status"]] ?? "" : "";

    const gender = GENDER_EN[genderRaw] ?? (["M", "F"].includes(genderRaw) ? genderRaw : null);
    const status = STATUS_LABEL_TO_EN[statusRaw] ??
      (["active", "attending", "inactive", "removed", "on_leave"].includes(statusRaw) ? statusRaw : "active");

    const emailRaw = headerMap["email"] !== undefined ? fields[headerMap["email"]] ?? "" : "";
    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      skipped.push({ row: i + 1, name, error: "이메일 형식이 올바르지 않습니다." });
      continue;
    }

    toInsert.push({
      name,
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
      return {
        success: false,
        error: `${imported}건 삽입 후 오류 발생: ${insertError.message}`,
      };
    }
    imported += batch.length;
  }

  revalidatePath("/members");
  return { success: true, imported, skipped };
}

export async function downloadCSVTemplate(): Promise<string> {
  return "\uFEFF" + CSV_HEADERS.join(",") + "\n홍길동,010-1234-5678,hong@email.com,남,1995-03-15,서울시 강남구,출석,hong_kakao,O,한국대학교,";
}

export async function returnFromLeave(memberId: number, leaveId: number): Promise<ActionResult> {
  const { supabase, user, role } = await requireAuth();
  if (role === "viewer") return { success: false, error: "권한이 없습니다." };

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
  await supabase.from("member_status_log").insert({
    member_id: memberId,
    old_status: "on_leave",
    new_status: "attending",
    changed_by: user.id,
  });

  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  return { success: true };
}
