import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "upper_room_leader" | "group_leader";

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

  const role: UserRole = (profile?.role as UserRole) || "group_leader";
  const linkedMemberId: number | null = (profile?.linked_member_id as number) ?? null;

  return { supabase, user, role, linkedMemberId };
}
