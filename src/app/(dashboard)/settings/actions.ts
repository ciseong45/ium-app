"use server";

import { requireAuth } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";
import type { UserEntry } from "@/types/settings";

export async function getUsers(): Promise<UserEntry[]> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, name, role, created_at, linked_member_id")
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as UserEntry[];
}

export async function getLinkableMembers(): Promise<{ id: number; last_name: string; first_name: string }[]> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return [];

  const { data, error } = await supabase
    .from("members")
    .select("id, last_name, first_name")
    .in("status", ["active", "attending"])
    .order("last_name")
    .order("first_name");

  if (error) return [];
  return data as { id: number; last_name: string; first_name: string }[];
}

export async function linkMemberToUser(
  targetUserId: string,
  memberId: number | null
): Promise<{ success: boolean; error?: string }> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase.rpc("link_member_to_user", {
    target_user_id: targetUserId,
    member_id_to_link: memberId,
  });

  if (error) {
    console.error("linkMemberToUser failed:", error.message);
    return { success: false, error: "멤버 연결에 실패했습니다." };
  }
  return { success: true };
}

export async function updateUserRole(
  targetUserId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  if (user.id === targetUserId)
    return { success: false, error: "자신의 역할은 변경할 수 없습니다." };
  if (!["admin", "upper_room_leader", "group_leader"].includes(newRole))
    return { success: false, error: "유효하지 않은 역할입니다." };

  const { error } = await supabase.rpc("update_user_role", {
    target_user_id: targetUserId,
    new_role: newRole,
  });

  if (error) {
    console.error("updateUserRole failed:", error.message);
    return { success: false, error: "역할 변경에 실패했습니다." };
  }
  return { success: true };
}

export async function deleteUser(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  if (user.id === targetUserId)
    return { success: false, error: "자신의 계정은 삭제할 수 없습니다." };

  const { error } = await supabase.rpc("admin_delete_user", {
    target_user_id: targetUserId,
  });

  if (error) {
    console.error("deleteUser failed:", error.message);
    return { success: false, error: "사용자 삭제에 실패했습니다." };
  }
  return { success: true };
}

export async function updateUserName(
  targetUserId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };

  const trimmed = newName.trim();
  if (!trimmed) return { success: false, error: "이름을 입력해주세요." };

  const { error } = await supabase.rpc("admin_update_user_name", {
    target_user_id: targetUserId,
    new_name: trimmed,
  });

  if (error) {
    console.error("updateUserName failed:", error.message);
    return { success: false, error: "이름 변경에 실패했습니다." };
  }
  return { success: true };
}
