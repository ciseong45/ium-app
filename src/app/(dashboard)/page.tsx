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
    <div className="space-y-8">
      {/* 내 순 바로가기 (순장/다락방장) */}
      {myGroups.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            {role === "upper_room_leader" ? "내 다락방 순" : "내 순"}
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myGroups.map((g) => (
              <Link
                key={g.id}
                href={`/attendance?group=${g.id}`}
                className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:border-indigo-200"
              >
                <div>
                  <p className="font-semibold text-gray-900">{g.name}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {g.upper_room_name} · {g.member_count}명
                  </p>
                </div>
                <span className="text-sm font-medium text-indigo-500 transition-transform duration-200 group-hover:translate-x-0.5">
                  출석 체크 →
                </span>
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
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
        />
        <DashboardCard
          title="순"
          value={`${groupCount}개`}
          description={seasonName}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-500"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>}
        />
        <DashboardCard
          title="출석률"
          value={totalChecked > 0 ? `${attendanceRate}%` : "—"}
          description={totalChecked > 0 ? `이번 주 ${presentCount}/${totalChecked}명` : "이번 주 기록 없음"}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          progress={totalChecked > 0 ? attendanceRate : undefined}
        />
        <DashboardCard
          title="새가족"
          value={`${newFamilyCount}명`}
          description="진행 중"
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>}
        />
        <DashboardCard
          title="1:1 양육"
          value={`${oneToOneCount}건`}
          description="진행 중"
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  description,
  iconBg,
  iconColor,
  icon,
  progress,
}: {
  title: string;
  value: string;
  description: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  progress?: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-gray-500">{title}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-[28px] font-bold tracking-tight text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-400">{description}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
