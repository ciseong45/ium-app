import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // OAuth 에러 파라미터가 있으면 로그인 페이지로 에러 전달
  if (error) {
    console.error("OAuth 에러:", error, errorDescription);
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", errorDescription || error);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "인증 코드가 없습니다.");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { data: { session }, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("세션 교환 실패:", exchangeError.message);
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  // 신규 Google 유저 → profiles 레코드 자동 생성
  if (session?.user) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", session.user.id)
      .single();

    if (!existing) {
      const meta = session.user.user_metadata;
      const { error: insertError } = await supabase.from("profiles").insert({
        id: session.user.id,
        name: meta?.full_name || meta?.name || session.user.email,
        email: session.user.email,
        role: "pending",
      });
      if (insertError) {
        console.error("프로필 생성 실패:", insertError.message);
      }
    }
  }

  return NextResponse.redirect(origin);
}
