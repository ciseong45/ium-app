import { getMembers } from "./actions";
import MemberList from "./MemberList";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const members = await getMembers(params.search, params.status);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">멤버 관리</h2>
        <a
          href="/members/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + 멤버 등록
        </a>
      </div>

      <MemberList
        members={members}
        currentSearch={params.search}
        currentStatus={params.status}
      />
    </div>
  );
}
