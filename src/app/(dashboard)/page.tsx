import { requireAuth } from "@/lib/auth";
import Link from "next/link";

const qtPassage = [
  "여호와의 말씀이 내게 임해 말씀하셨다.",
  "사람아, 너는 네 얼굴을 암몬 자손들에게로 향해 그들에 대해 예언하여라.",
  "암몬 자손들에게 말하여라. ‘주 여호와의 말을 들으라.’ 주 여호와께서 이렇게 말씀하셨다. “내 성소가 더럽혀질 때 내 성소에 대해, 이스라엘의 땅이 폐허가 될 때 이스라엘의 땅에 대해, 유다의 집이 포로로 잡혀갈 때 유다의 집에 대해 네가 ‘아하!’라고 말했다.”",
  "그렇기 때문에 내가 너를 동쪽 사람들에게 넘겨주어 그가 너를 소유하게 할 것이다. 그들이 너희 가운데 진을 치고 너희 가운데 거처를 마련할 것이다. 그들이 네 열매를 먹고 네 우유를 마실 것이다.",
  "내가 랍바를 낙타의 우리로 삼을 것이요 암몬 자손을 양 떼의 쉼터로 삼을 것이다. 그러면 내가 여호와임을 너희가 알게 될 것이다.",
  "나 주 여호와가 이렇게 말한다. 이스라엘 땅에 대해 네가 손뼉을 치고 발을 구르며 온 마음으로 경멸하며 기뻐했기 때문에",
  "내가 내 손을 네게 뻗어 너를 민족들에게 전리품으로 줄 것이다. 내가 너를 백성들 가운데서 죽일 것이고 나라들 가운데 너를 멸망하게 할 것이다. 내가 너를 폐망시킬 것이다. 그러면 내가 여호와임을 네가 알게 될 것이다.",
  "주 여호와께서 이렇게 말씀하셨다. “‘유다 족속이 다른 모든 이방 민족들과 같다’라고 모압과 세일이 말하기 때문에",
  "모압 변방에 있는 성읍들, 그 땅의 영광인 벧여시못, 바알므온, 기랴다임을 내가 깨끗이 없애 버릴 것이다.",
  "그 땅과 암몬 자손들을 동쪽 사람들에게 넘겨줘 차지하게 할 것이니 이는 암몬 자손들이 민족들 사이에서 기억되지 않게 하려 함이다.",
  "그리고 내가 모압에게 심판을 내릴 것이다. 그러면 내가 여호와임을 그들이 알게 될 것이다.",
];

const qtRhythm = [
  "찬양 또는 1분 침묵",
  "짧은 기도",
  "본문 2-3번 천천히 읽기",
  "마음에 남는 말씀 묵상하기",
  "오늘의 작은 순종 정하기",
  "Discord에 짧게 나누기",
];

export default async function DashboardPage() {
  const { supabase, role, linkedMemberId } = await requireAuth();

  // 병렬로 모든 통계 데이터 가져오기
  const [
    membersRes,
    activeSeasonRes,
    attendanceRes,
    newFamilyRes,
    oneToOneRes,
    worshipMembersRes,
    upcomingEventsRes,
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
    // 찬양팀 인원
    supabase
      .from("member_ministry_teams")
      .select("id", { count: "exact", head: true })
      .eq("ministry_team_id", 1),
    // 다가올 행사
    supabase
      .from("events")
      .select("id, name, start_date")
      .gte("start_date", new Date().toISOString().split("T")[0])
      .order("start_date")
      .limit(3),
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

  // 찬양팀 수
  const worshipMemberCount = worshipMembersRes.count ?? 0;

  // 다가올 행사
  const upcomingEvents = upcomingEventsRes.data ?? [];

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
      {/* 공지 */}
      <section>
        <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-[var(--color-warm-muted)]">
          Notice
        </p>
        <div className="editorial-divider mt-2 mb-5" />
        <Link
          href="/summer-apply"
          className="group flex flex-col gap-4 rounded-xl border border-[var(--color-warm-border)] bg-white p-6 hover-lift sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-serif text-xl font-light tracking-tight text-[var(--color-warm-text)]">
              2026 여름순 신청
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-warm-muted)]">
              새가족과 방문자가 직접 신청할 수 있는 공개 신청폼입니다.
            </p>
          </div>
          <span className="text-sm font-medium text-[var(--color-warm-muted)] transition-all duration-300 group-hover:text-[var(--color-warm-text)] group-hover:translate-x-0.5">
            신청폼 열기 →
          </span>
        </Link>
      </section>

      {/* 이번주 말씀 */}
      <section>
        <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-[var(--color-warm-muted)]">
          This Week
        </p>
        <div className="editorial-divider mt-2 mb-5" />
        <div className="space-y-5">
          <div>
            <p className="font-serif text-2xl font-light tracking-tight text-[var(--color-warm-text)]">
              이번주 말씀
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-warm-muted)]">
              말씀 앞에 멈추고, 하나님이 나의 주인이 되시는 삶을 함께 배웁니다.
            </p>
          </div>

          <article className="rounded-xl border border-[var(--color-warm-border)] bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="flex flex-col gap-5 border-b border-[var(--color-warm-border-light)] pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[9px] font-medium uppercase tracking-[0.24em] text-[var(--color-warm-subtle)]">
                  Summer QT Gathering
                </p>
                <h2 className="mt-3 font-serif text-3xl font-light tracking-tight text-[var(--color-warm-text)]">
                  여름 큐티 모임
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-warm-muted)]">
                  2주차 · 멈추는 훈련
                </p>
              </div>
              <div className="rounded-lg border border-[var(--color-warm-border-light)] px-4 py-3 text-left sm:text-right">
                <p className="text-[11px] font-medium text-[var(--color-warm-muted)]">
                  오늘 본문
                </p>
                <p className="mt-1 font-serif text-xl font-light text-[var(--color-warm-text)]">
                  에스겔 25:1-11
                </p>
              </div>
            </div>

            <div className="grid gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-7">
                <section>
                  <h3 className="font-serif text-xl font-light text-[var(--color-warm-text)]">
                    2주차 핵심: 멈추는 훈련
                  </h3>
                  <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--color-warm-text)]">
                    <p>
                      큐티가 어려운 이유는 말씀이 중요하지 않아서가 아닙니다. 대부분 우리는 중요하다는 것을 알지만, 바쁨 속에서 멈추지 못합니다.
                    </p>
                    <p>
                      예수님도 사역의 바쁨 속에서 한적한 곳으로 물러나 기도하셨습니다. 큐티는 마음이 여유로워질 때까지 기다리는 것이 아니라, 하나님 앞에 서기 위해 시간과 장소를 실제로 구별하는 훈련입니다.
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="font-serif text-xl font-light text-[var(--color-warm-text)]">
                    왜 큐티를 해야 하는가?
                  </h3>
                  <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--color-warm-text)]">
                    <p>
                      우리는 가치 있고 의미 있는 인생을 살기 원합니다. 그러려면 삶을 잘 살아야 하고, 무엇이 가치 있고 의미 있는 삶인지 알아야 합니다. 내가 내 인생의 주인이 되는 한, 아무리 열심히 살아도 귀한 인생을 살 수 없습니다. 하나님이 나의 주인이 되셔야 합니다.
                    </p>
                    <p>
                      예수님을 만나지 않고 구원받지 않으면, 살 수도 누릴 수도 없는 세상이 있습니다. 하나님의 나라와 아무 상관없이 살아가게 됩니다. 성령은 말씀을 통해 우리가 하나님의 뜻을 분별하게 하시고, 그 뜻대로 살도록 인도하시는 분입니다.
                    </p>
                    <p>
                      그래서 우리는 말씀 앞에 나아갑니다. 큐티는 말씀을 통해 하나님의 음성을 듣고 분별하며, 인생을 제대로 살아가기 위한 훈련입니다.
                    </p>
                  </div>
                </section>

                <section className="rounded-lg bg-[var(--color-warm-bg)] p-5">
                  <h3 className="font-serif text-xl font-light text-[var(--color-warm-text)]">
                    삶을 드리는 30분
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-[var(--color-warm-text)]">
                    요한복음 6장의 오병이어 사건에서 똑같은 빵과 고기라도 주님이 잡으시니 다른 일이 일어납니다. 적은 것을 주님께서 쓰시면 놀라운 일이 가능합니다. 우리는 가진 만큼만 사는 것이 아니라, 주님의 능력만큼 살게 됩니다. 큐티의 시간은 그 시간을 주님과 함께하는 시간이기에 중요합니다.
                  </p>
                </section>

                <section>
                  <h3 className="font-serif text-xl font-light text-[var(--color-warm-text)]">
                    큐티의 원칙
                  </h3>
                  <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--color-warm-text)]">
                    <p>
                      큐티는 내가 먼저 결정해 놓고 하나님께 확인받는 시간이 아닙니다. 큐티는 주님과의 교제입니다. 이미 내 뜻을 정해 놓고 주님께 나오면, 그 자리는 주님의 의견을 듣는 자리가 아니라 내 의견을 들으라고 요구하는 자리가 됩니다.
                    </p>
                    <p>
                      큐티의 태도는 “주의 종이 듣겠나이다”입니다. 이 태도 가운데 주님께서 말씀하십니다.
                    </p>
                    <blockquote className="border-l border-[var(--color-warm-border)] pl-4 text-[var(--color-warm-muted)]">
                      큐티는 매일 조용한 시간과 장소를 정하여 하나님을 개인적으로 만나는 시간입니다. 성경 말씀을 통하여 나를 향하신 하나님의 말씀을 듣고 묵상하며 삶에 적용함으로써, 삶의 변화와 성숙을 이루고자 하는 경건의 훈련입니다.
                    </blockquote>
                    <p className="text-[var(--color-warm-muted)]">
                      딤후 3:5 · 경건의 모양은 있으나 경건의 능력은 부인하니 이같은 자들에게서 네가 돌아서라
                    </p>
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-lg border border-[var(--color-warm-border-light)] p-5">
                  <h3 className="font-serif text-xl font-light text-[var(--color-warm-text)]">
                    오늘 본문
                  </h3>
                  <p className="mt-1 text-[12px] text-[var(--color-warm-muted)]">
                    우리말 · 에스겔 25:1-11
                  </p>
                  <ol className="mt-5 space-y-3 text-sm leading-7 text-[var(--color-warm-text)]">
                    {qtPassage.map((verse, index) => (
                      <li key={verse} className="grid grid-cols-[24px_1fr] gap-2">
                        <span className="pt-0.5 text-[11px] text-[var(--color-warm-subtle)]">
                          {index + 1}
                        </span>
                        <span>{verse}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="rounded-lg border border-[var(--color-warm-border-light)] p-5">
                  <h3 className="font-serif text-xl font-light text-[var(--color-warm-text)]">
                    매일 큐티 기본 리듬
                  </h3>
                  <ol className="mt-5 space-y-3 text-sm text-[var(--color-warm-text)]">
                    {qtRhythm.map((item, index) => (
                      <li key={item} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-warm-bg)] text-[11px] text-[var(--color-warm-muted)]">
                          {index + 1}
                        </span>
                        <span className="pt-0.5">{item}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="rounded-lg bg-[var(--color-warm-text)] p-5 text-white">
                  <h3 className="font-serif text-xl font-light">
                    이번주 나의 결단
                  </h3>
                  <div className="mt-5 space-y-4 text-sm leading-7 text-white/80">
                    <p>
                      이번 주 나는
                    </p>
                    <div className="space-y-3">
                      <div className="border-b border-white/20 pb-2">요일:</div>
                      <div className="border-b border-white/20 pb-2">시간:</div>
                      <div className="border-b border-white/20 pb-2">장소:</div>
                      <div className="border-b border-white/20 pb-2">오늘의 작은 순종:</div>
                      <div className="border-b border-white/20 pb-2">기도 제목:</div>
                    </div>
                    <p className="pt-2 text-white">
                      하나님과 함께하는 3주가 되기를.
                    </p>
                  </div>
                </section>
              </aside>
            </div>
          </article>
        </div>
      </section>

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
            description="재적 + 출석 + 연결 진행 중"
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
          <DashboardCard
            label="Worship"
            title="찬양팀"
            value={`${worshipMemberCount}`}
            unit="명"
            description="사역자"
            href="/worship"
          />
          <DashboardCard
            label="Events"
            title="행사"
            value={`${upcomingEvents.length}`}
            unit="건"
            description={upcomingEvents.length > 0 ? (upcomingEvents[0] as { name: string }).name : "예정 없음"}
            href="/events"
          />
        </div>
      </section>
    </div>
  );
}

function DashboardCard({
  label,
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
