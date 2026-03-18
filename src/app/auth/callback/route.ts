import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code);

    // 신규 Google 유저 → profiles 레코드 자동 생성
    if (session?.user) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.user.id)
        .single();

      if (!existing) {
        const meta = session.user.user_metadata;
        await supabase.from("profiles").insert({
          id: session.user.id,
          name: meta?.full_name || meta?.name || session.user.email,
          role: "group_leader",
        });
      }
    }
  }

  return NextResponse.redirect(origin);
}
