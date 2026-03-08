import { getOneToOnes, getActiveMembers } from "./actions";
import OneToOneView from "./OneToOneView";

export default async function OneToOnePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const [entries, members] = await Promise.all([
    getOneToOnes(params.status),
    getActiveMembers(),
  ]);

  return (
    <OneToOneView
      entries={entries}
      members={members}
      currentStatus={params.status || "all"}
    />
  );
}
