"use server";

import { requireAuth } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";

export type UserEntry = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: string;
};

export async function getUsers(): Promise<UserEntry[]> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin") throw new Error("권한이 없습니다.");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, name, role, created_at")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as UserEntry[];
}

export async function updateUserRole(
  targetUserId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user, role } = await requireAuth();
  if (role !== "admin") return { success: false, error: "권한이 없습니다." };
  if (user.id === targetUserId)
    return { success: false, error: "자신의 역할은 변경할 수 없습니다." };
  if (!["admin", "leader", "viewer"].includes(newRole))
    return { success: false, error: "유효하지 않은 역할입니다." };

  const { error } = await supabase.rpc("update_user_role", {
    target_user_id: targetUserId,
    new_role: newRole,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
