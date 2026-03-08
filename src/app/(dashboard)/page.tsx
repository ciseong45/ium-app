import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>
      <p className="mt-2 text-gray-600">
        환영합니다{user?.email ? `, ${user.email}` : ""} 님
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard title="멤버" value="—" description="전체 재적 멤버" />
        <DashboardCard title="소그룹" value="—" description="현재 시즌" />
        <DashboardCard title="출석률" value="—" description="이번 주" />
        <DashboardCard title="새가족" value="—" description="진행 중" />
        <DashboardCard title="1:1 양육" value="—" description="진행 중" />
      </div>

      <p className="mt-8 text-sm text-gray-400">
        Phase 2부터 실제 데이터가 표시됩니다.
      </p>
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
