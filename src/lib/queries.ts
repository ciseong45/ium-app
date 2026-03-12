import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 공통 DB 헬퍼 함수 모음
 * requireAuth()로 이미 인증된 supabase 클라이언트를 받아서 사용합니다.
 */

// ===== 활성 시즌 조회 =====

export async function getActiveSeason(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("small_group_seasons")
    .select("id, name, is_active")
    .eq("is_active", true)
    .single();
  return data as { id: number; name: string; is_active: boolean } | null;
}

// ===== 활성 멤버 조회 =====

export async function fetchActiveMembers(
  supabase: SupabaseClient,
  statusFilter: string[] = ["active", "attending"]
) {
  const { data, error } = await supabase
    .from("members")
    .select("id, last_name, first_name")
    .in("status", statusFilter)
    .order("last_name")
    .order("first_name");
  if (error) return [];
  return data as { id: number; last_name: string; first_name: string }[];
}

// ===== 상태 변경 이력 기록 =====

export async function insertStatusLog(
  supabase: SupabaseClient,
  memberId: number,
  oldStatus: string | null,
  newStatus: string,
  changedBy: string | null
) {
  await supabase.from("member_status_log").insert({
    member_id: memberId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy,
  });
}

// ===== 새가족 엔트리 자동 생성 =====

export async function ensureNewFamilyEntry(
  supabase: SupabaseClient,
  memberId: number
): Promise<void> {
  const { data: existing } = await supabase
    .from("new_family")
    .select("id")
    .eq("member_id", memberId)
    .single();

  if (existing) return;

  const activeSeason = await getActiveSeason(supabase);
  const today = new Date().toISOString().split("T")[0];

  await supabase.from("new_family").insert({
    member_id: memberId,
    first_visit: today,
    season_id: activeSeason?.id || null,
  });
}

// ===== 적응중 멤버 만료 일괄 처리 =====

export async function expireAdjustingMembers(
  supabase: SupabaseClient,
  memberIds: number[]
): Promise<number[]> {
  if (memberIds.length === 0) return [];

  // 3개월 전 날짜
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // step 3 완료 + 3개월 경과 멤버 조회
  const { data: nfEntries } = await supabase
    .from("new_family")
    .select("member_id, step_updated_at")
    .in("member_id", memberIds)
    .eq("step", 3);

  const expiredIds = (nfEntries ?? [])
    .filter((nf) => new Date(nf.step_updated_at) < threeMonthsAgo)
    .map((nf) => nf.member_id as number);

  if (expiredIds.length === 0) return [];

  // batch update: adjusting → attending
  await supabase
    .from("members")
    .update({ status: "attending" })
    .in("id", expiredIds);

  // batch insert: 상태 이력
  await supabase.from("member_status_log").insert(
    expiredIds.map((id) => ({
      member_id: id,
      old_status: "adjusting",
      new_status: "attending",
      changed_by: null,
    }))
  );

  return expiredIds;
}
