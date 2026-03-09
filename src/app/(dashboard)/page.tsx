import { requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  const { supabase, user } = await requireAuth();

  // 병렬로 모든 통계 데이터 가져오기
  const [
    membersRes,
    activeSeasonRes,
    attendanceRes,
    newFamilyRes,
    oneToOneRes,
  ] = await Promise.all([
    // 재적/출석 멤버 수
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "attending", "adjusting"]),
    // 현재 활성 시즌
    supabase
      .from("small_group_seasons")
      .select("id, name")
      .eq("is_active", true)
      .single(),
    // 이번 주 출석 데이터
    (() => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - dayOfWeek);
      const weekDate = lastSunday.toISOString().split("T")[0];
      return supabase
        .from("attendance")
        .select("status")
        .eq("week_date", weekDate);
    })(),
    // 진행 중 새가족 (step < 3)
    supabase
      .from("new_family")
      .select("id", { count: "exact", head: true })
      .lt("step", 3),
    // 진행 중 1:1 양육
    supabase
      .from("one_to_one")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  // 멤버 수
  const memberCount = membersRes.count ?? 0;

  // 활성 시즌 이름
  const seasonName = activeSeasonRes.data?.name ?? "없음";

  // 소그룹 수 (활성 시즌이 있을 때만)
  let groupCount = 0;
  if (activeSeasonRes.data) {
    const { count } = await supabase
      .from("small_groups")
      .select("id", { count: "exact", head: true })
      .eq("season_id", activeSeasonRes.data.id);
    groupCount = count ?? 0;
  }

  // 출석률 계산
  const attendanceRecords = attendanceRes.data ?? [];
  const totalChecked = attendanceRecords.length;
  const presentCount = attendanceRecords.filter(
    (r) => r.status === "present" || r.status === "online"
  ).length;
  const attendanceRate = totalChecked > 0
    ? Math.round((presentCount / totalChecked) * 100)
    : 0;

  // 새가족 수
  const newFamilyCount = newFamilyRes.count ?? 0;

  // 양육 수
  const oneToOneCount = oneToOneRes.count ?? 0;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>
      <p className="mt-2 text-gray-600">
        환영합니다{user?.email ? `, ${user.email}` : ""} 님
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="멤버"
          value={`${memberCount}명`}
          description="재적 + 출석 + 적응중 멤버"
        />
        <DashboardCard
          title="소그룹"
          value={`${groupCount}개`}
          description={seasonName}
        />
        <DashboardCard
          title="출석률"
          value={totalChecked > 0 ? `${attendanceRate}%` : "—"}
          description={totalChecked > 0 ? `이번 주 ${presentCount}/${totalChecked}명` : "이번 주 기록 없음"}
        />
        <DashboardCard
          title="새가족"
          value={`${newFamilyCount}명`}
          description="진행 중"
        />
        <DashboardCard
          title="1:1 양육"
          value={`${oneToOneCount}건`}
          description="진행 중"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{description}</p>
    </div>
  );
}
