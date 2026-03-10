import { getMembersWithGroups, getFilterOptions } from "./actions";
import { requireAuth } from "@/lib/auth";
import MemberList from "./MemberList";
import CSVControls from "./CSVControls";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    group?: string;
    school?: string;
    birth_year?: string;
    ministry_team?: string;
  }>;
}) {
  const params = await searchParams;
  const effectiveStatus = params.status || "active";
  const [members, { role }, filterOptions] = await Promise.all([
    getMembersWithGroups(
      params.search,
      effectiveStatus,
      params.group,
      params.school,
      params.birth_year,
      params.ministry_team
    ),
    requireAuth(),
    getFilterOptions(),
  ]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-light tracking-tight text-[var(--color-warm-text)]">멤버 관리</h2>
          <p className="mt-1 text-[12px] text-[var(--color-warm-muted)]">교회 멤버 정보를 관리하고 검색합니다</p>
        </div>
        <div className="flex items-center gap-2">
          <CSVControls role={role} />
          {role !== "group_leader" && (
            <a
              href="/members/new"
              className="rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333]"
            >
              + 멤버 등록
            </a>
          )}
        </div>
      </div>

      <MemberList
        members={members}
        currentSearch={params.search}
        currentStatus={effectiveStatus}
        currentGroup={params.group}
        currentSchool={params.school}
        currentBirthYear={params.birth_year}
        currentMinistryTeam={params.ministry_team}
        filterOptions={filterOptions}
        role={role}
      />
    </div>
  );
}
