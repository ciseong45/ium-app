import { requireAuth } from "@/lib/auth";
import { getActiveSeason } from "@/lib/queries";
import Link from "next/link";

export default async function DashboardPage() {
  const { supabase, user, role, linkedMemberId } = await requireAuth();

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
    (r) => r.status === "present"
  ).length;
  const attendanceRate = totalChecked > 0
    ? Math.round((presentCount / totalChecked) * 100)
    : 0;

  // 새가족 수
  const newFamilyCount = newFamilyRes.count ?? 0;

  // 양육 수
  const oneToOneCount = oneToOneRes.count ?? 0;

  // 내 순/다락방 정보 (순장, 다락방장용)
  type MyGroupInfo = {
    id: number;
    name: string;
    upper_room_name: string;
    member_count: number;
  };
  let myGroups: MyGroupInfo[] = [];

  if (linkedMemberId && activeSeasonRes.data) {
    const seasonId = activeSeasonRes.data.id;

    if (role === "group_leader") {
      // 순장: 자기가 리더인 순
      const { data: groups } = await supabase
        .from("small_groups")
        .select("id, name, upper_room:upper_rooms!upper_room_id(name)")
        .eq("leader_id", linkedMemberId)
        .eq("season_id", seasonId);

      if (groups) {
        for (const g of groups) {
          const { count } = await supabase
            .from("small_group_members")
            .select("id", { count: "exact", head: true })
            .eq("group_id", g.id);
          myGroups.push({
            id: g.id,
            name: g.name,
            upper_room_name: (g.upper_room as any)?.name ?? "",
            member_count: count ?? 0,
          });
        }
      }
    } else if (role === "upper_room_leader") {
      // 다락방장: 자기 다락방의 모든 순
      const { data: myUpperRooms } = await supabase
        .from("upper_rooms")
        .select("id, name")
        .eq("leader_id", linkedMemberId)
        .eq("season_id", seasonId);

      if (myUpperRooms) {
        const urIds = myUpperRooms.map((ur) => ur.id);
        if (urIds.length > 0) {
          const { data: groups } = await supabase
            .from("small_groups")
            .select("id, name, upper_room:upper_rooms!upper_room_id(name)")
            .in("upper_room_id", urIds)
            .order("name");

          if (groups) {
            for (const g of groups) {
              const { count } = await supabase
                .from("small_group_members")
                .select("id", { count: "exact", head: true })
                .eq("group_id", g.id);
              myGroups.push({
                id: g.id,
                name: g.name,
                upper_room_name: (g.upper_room as any)?.name ?? "",
                member_count: count ?? 0,
              });
            }
          }
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* 내 순 바로가기 (순장/다락방장) */}
      {myGroups.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            {role === "upper_room_leader" ? "내 다락방 순" : "내 순"}
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myGroups.map((g) => (
              <Link
                key={g.id}
                href={`/attendance?group=${g.id}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="font-medium text-gray-900">{g.name}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {g.upper_room_name} · {g.member_count}명
                  </p>
                </div>
                <span className="text-sm font-medium text-blue-600">출석 체크 →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="멤버"
          value={`${memberCount}명`}
          description="재적 + 출석 + 적응중 멤버"
          accent="border-l-blue-500"
        />
        <DashboardCard
          title="순"
          value={`${groupCount}개`}
          description={seasonName}
          accent="border-l-indigo-500"
        />
        <DashboardCard
          title="출석률"
          value={totalChecked > 0 ? `${attendanceRate}%` : "—"}
          description={totalChecked > 0 ? `이번 주 ${presentCount}/${totalChecked}명` : "이번 주 기록 없음"}
          accent="border-l-green-500"
          progress={totalChecked > 0 ? attendanceRate : undefined}
        />
        <DashboardCard
          title="새가족"
          value={`${newFamilyCount}명`}
          description="진행 중"
          accent="border-l-purple-500"
        />
        <DashboardCard
          title="1:1 양육"
          value={`${oneToOneCount}건`}
          description="진행 중"
          accent="border-l-amber-500"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  description,
  accent = "border-l-blue-500",
  progress,
}: {
  title: string;
  value: string;
  description: string;
  accent?: string;
  progress?: number;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 border-l-4 ${accent} bg-white p-5 shadow-sm`}>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{description}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
