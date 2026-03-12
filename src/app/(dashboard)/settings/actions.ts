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

  if (error) return { success: false, error: error.message };
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

  if (error) return { success: false, error: error.message };
  return { success: true };
}
