import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "leader" | "viewer";

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
    .select("role")
    .eq("id", user.id)
    .single();

  const role: UserRole = (profile?.role as UserRole) || "viewer";

  return { supabase, user, role };
}
