import { requireAuth } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const { supabase, role, linkedMemberId } = await requireAuth();

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
  const myGroups: MyGroupInfo[] = [];

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
            upper_room_name: (g.upper_room as unknown as { name: string } | null)?.name ?? "",
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
                upper_room_name: (g.upper_room as unknown as { name: string } | null)?.name ?? "",
                member_count: count ?? 0,
              });
            }
          }
        }
      }
    }
  }

  return (
    <div className="space-y-12 animate-fade-in">
      {/* 내 순 바로가기 (순장/다락방장) */}
      {myGroups.length > 0 && (
        <section>
          <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-[var(--color-warm-muted)]">
            {role === "upper_room_leader" ? "My Upper Room" : "My Group"}
          </p>
          <div className="editorial-divider mt-2 mb-5" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myGroups.map((g) => (
              <Link
                key={g.id}
                href={`/attendance?group=${g.id}`}
                className="group flex items-center justify-between rounded-xl border border-[var(--color-warm-border)] bg-white p-5 hover-lift"
              >
                <div>
                  <p className="font-serif text-lg font-light text-[var(--color-warm-text)]">{g.name}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--color-warm-muted)]">
                    {g.upper_room_name} · {g.member_count}명
                  </p>
                </div>
                <span className="text-[12px] font-medium text-[var(--color-warm-muted)] transition-all duration-300 group-hover:text-[var(--color-warm-text)] group-hover:translate-x-0.5">
                  출석 체크 →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 통계 카드 */}
      <section>
        <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-[var(--color-warm-muted)]">
          Overview
        </p>
        <div className="editorial-divider mt-2 mb-5" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            label="Members"
            title="멤버"
            value={`${memberCount}`}
            unit="명"
            description="재적 + 출석 + 적응중"
            href="/members"
          />
          <DashboardCard
            label="Groups"
            title="순"
            value={`${groupCount}`}
            unit="개"
            description={seasonName}
            href="/small-groups"
          />
          <DashboardCard
            label="Attendance"
            title="출석률"
            value={totalChecked > 0 ? `${attendanceRate}` : "—"}
            unit={totalChecked > 0 ? "%" : ""}
            description={totalChecked > 0 ? `이번 주 ${presentCount}/${totalChecked}명` : "이번 주 기록 없음"}
            progress={totalChecked > 0 ? attendanceRate : undefined}
            href="/attendance"
          />
          <DashboardCard
            label="New Family"
            title="새가족"
            value={`${newFamilyCount}`}
            unit="명"
            description="진행 중"
            href="/new-family"
          />
          <DashboardCard
            label="Discipleship"
            title="1:1 양육"
            value={`${oneToOneCount}`}
            unit="건"
            description="진행 중"
            href="/one-to-one"
          />
        </div>
      </section>
    </div>
  );
}

function DashboardCard({
  label,
  title,
  value,
  unit,
  description,
  progress,
  href,
}: {
  label: string;
  title: string;
  value: string;
  unit: string;
  description: string;
  progress?: number;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[var(--color-warm-subtle)]">
        {label}
      </p>
      <p className="mt-4 font-serif text-[36px] font-light tracking-tight text-[var(--color-warm-text)] leading-none">
        {value}
        <span className="ml-1 text-[16px] font-sans font-normal text-[var(--color-warm-muted)]">{unit}</span>
      </p>
      <p className="mt-2 text-[12px] text-[var(--color-warm-muted)]">{description}</p>
      {progress !== undefined && (
        <div className="mt-4 h-[2px] w-full overflow-hidden bg-[var(--color-warm-border-light)]">
          <div
            className="h-full bg-[var(--color-warm-text)] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl border border-[var(--color-warm-border)] bg-white p-6 hover-lift"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-warm-border)] bg-white p-6 hover-lift">
      {content}
    </div>
  );
}
