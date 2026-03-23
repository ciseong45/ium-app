import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "upper_room_leader" | "group_leader" | "pending";

export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("인증이 필요합니다.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, linked_member_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    throw new Error("프로필을 찾을 수 없습니다. 관리자에게 문의하세요.");
  }

  const role: UserRole = profile.role as UserRole;
  const linkedMemberId: number | null = (profile.linked_member_id as number) ?? null;

  return { supabase, user, role, linkedMemberId };
}
