import { getNewFamilies, getActiveMembers, getSeasons } from "./actions";
import NewFamilyView from "./NewFamilyView";

export default async function NewFamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const seasonId = params.season ? Number(params.season) : undefined;

  const [families, members, seasons] = await Promise.all([
    getNewFamilies(seasonId),
    getActiveMembers(),
    getSeasons(),
  ]);

  return (
    <NewFamilyView
      families={families}
      members={members}
      seasons={seasons}
      currentSeasonId={seasonId}
    />
  );
}
