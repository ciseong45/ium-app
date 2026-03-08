"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MemberStatus, LeaveType } from "@/types/member";

export async function getMembers(search?: string, status?: string) {
  const supabase = await createClient();

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

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getMember(id: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createMember(formData: FormData) {
  const supabase = await createClient();

  const member = {
    name: formData.get("name") as string,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    gender: (formData.get("gender") as string) || null,
    birth_date: (formData.get("birth_date") as string) || null,
    address: (formData.get("address") as string) || null,
    status: (formData.get("status") as string) || "active",
    notes: (formData.get("notes") as string) || null,
  };

  const { error } = await supabase.from("members").insert(member);

  if (error) throw error;

  revalidatePath("/members");
  return { success: true };
}

export async function updateMember(id: number, formData: FormData) {
  const supabase = await createClient();

  // 현재 멤버 정보 가져오기 (상태 변경 이력용)
  const { data: current } = await supabase
    .from("members")
    .select("status")
    .eq("id", id)
    .single();

  const newStatus = formData.get("status") as MemberStatus;

  const member = {
    name: formData.get("name") as string,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    gender: (formData.get("gender") as string) || null,
    birth_date: (formData.get("birth_date") as string) || null,
    address: (formData.get("address") as string) || null,
    status: newStatus,
    notes: (formData.get("notes") as string) || null,
  };

  const { error } = await supabase
    .from("members")
    .update(member)
    .eq("id", id);

  if (error) throw error;

  // 상태가 변경되었으면 이력 기록
  if (current && current.status !== newStatus) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("member_status_log").insert({
      member_id: id,
      old_status: current.status,
      new_status: newStatus,
      changed_by: user?.id,
    });
  }

  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  return { success: true };
}

export async function deleteMember(id: number) {
  const supabase = await createClient();

  const { error } = await supabase.from("members").delete().eq("id", id);

  if (error) throw error;

  revalidatePath("/members");
  return { success: true };
}

export async function getStatusLog(memberId: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("member_status_log")
    .select("*, profiles(name)")
    .eq("member_id", memberId)
    .order("changed_at", { ascending: false });

  if (error) throw error;
  return data;
}

// ===== 휴적 관리 =====

export async function getMemberLeaves(memberId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_leaves")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function startLeave(
  memberId: number,
  leaveType: LeaveType,
  reason: string | null,
  startDate: string,
  expectedReturn: string | null
) {
  const supabase = await createClient();

  // 현재 멤버 상태 확인
  const { data: member } = await supabase
    .from("members")
    .select("status")
    .eq("id", memberId)
    .single();

  if (!member) throw new Error("멤버를 찾을 수 없습니다.");

  // 휴적 기록 생성
  const { error: leaveError } = await supabase.from("member_leaves").insert({
    member_id: memberId,
    leave_type: leaveType,
    reason,
    start_date: startDate,
    expected_return: expectedReturn || null,
  });
  if (leaveError) throw leaveError;

  // 멤버 상태를 on_leave로 변경
  const { error: updateError } = await supabase
    .from("members")
    .update({ status: "on_leave" as MemberStatus })
    .eq("id", memberId);
  if (updateError) throw updateError;

  // 상태 변경 이력 기록
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("member_status_log").insert({
    member_id: memberId,
    old_status: member.status,
    new_status: "on_leave",
    changed_by: user?.id,
  });

  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  return { success: true };
}

export async function returnFromLeave(memberId: number, leaveId: number) {
  const supabase = await createClient();

  // 휴적 기록에 복귀일 기록
  const { error: leaveError } = await supabase
    .from("member_leaves")
    .update({ actual_return: new Date().toISOString().split("T")[0] })
    .eq("id", leaveId);
  if (leaveError) throw leaveError;

  // 멤버 상태를 attending으로 복귀
  const { error: updateError } = await supabase
    .from("members")
    .update({ status: "attending" as MemberStatus })
    .eq("id", memberId);
  if (updateError) throw updateError;

  // 상태 변경 이력 기록
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("member_status_log").insert({
    member_id: memberId,
    old_status: "on_leave",
    new_status: "attending",
    changed_by: user?.id,
  });

  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  return { success: true };
}
