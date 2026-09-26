import { createHash, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { applicationInput, normalizePhone } from "@/lib/small-group-registration";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 8192) return NextResponse.json({ error: "입력 내용이 너무 깁니다." }, { status: 413 });
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 8192) return NextResponse.json({ error: "입력 내용이 너무 깁니다." }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "입력 내용을 확인해주세요." }, { status: 400 });
  }
  const parsed = applicationInput.safeParse(body);
  if (!parsed.success || !body || typeof body !== "object" ||
    Object.keys(body).some((key) => !Object.keys(applicationInput.shape).includes(key))) {
    return NextResponse.json({ error: "입력 내용을 확인해주세요." }, { status: 400 });
  }
  if (parsed.data.website) return NextResponse.json({ ok: true });
  const phone = normalizePhone(parsed.data.phone, parsed.data.country);
  if (!phone) return NextResponse.json({ error: "연락처와 국가를 확인해주세요." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rateSecret = process.env.GROUP_APPLY_RATE_SECRET;
  if (!url || !serviceKey || !rateSecret) {
    return NextResponse.json({ error: "신청 환경을 확인하는 중입니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  const submitted = parsed.data;
  const payload = JSON.stringify({ slug: submitted.slug, name: submitted.name.normalize("NFC"),
    phone, kind: submitted.kind, note: submitted.note, consentVersion: submitted.consentVersion });
  const payloadHash = createHash("sha256").update(payload).digest("hex");
  // Vercel supplies x-vercel-forwarded-for from its ingress. Unknown IPs share one rate bucket.
  const forwarded = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded && /^[\d.:a-fA-F]+$/.test(forwarded) ? forwarded : "unknown";
  const clientKey = createHmac("sha256", rateSecret).update(ip).digest("hex");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await supabase.rpc("receive_group_application", {
    p_slug: submitted.slug, p_key: submitted.submissionKey,
    p_name: submitted.name.normalize("NFC"), p_phone: phone,
    p_kind: submitted.kind, p_note: submitted.note,
    p_notice_version: submitted.consentVersion,
    p_payload_hash: payloadHash, p_client_key: clientKey,
  });
  if (!error) return NextResponse.json({ ok: true });
  if (error.message.includes("CAMPAIGN_NOT_OPEN")) return NextResponse.json({ error: "현재 신청 기간이 아닙니다." }, { status: 409 });
  if (error.message.includes("NOTICE_CHANGED")) return NextResponse.json({ error: "안내 내용이 변경됐습니다. 페이지를 새로 열어주세요." }, { status: 409 });
  if (error.message.includes("RATE_LIMITED")) return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  if (error.message.includes("SUBMISSION_KEY_CONFLICT")) return NextResponse.json({ error: "신청 내용이 달라졌습니다. 페이지를 새로 열어주세요." }, { status: 409 });
  if (error.message.includes("VALIDATION_ERROR")) return NextResponse.json({ error: "입력 내용을 확인해주세요." }, { status: 400 });
  return NextResponse.json({ error: "신청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
}
