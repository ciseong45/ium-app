import { getNewFamilies, getActiveMembers, getSeasons } from "./actions";
import { markDroppedOutNewFamilies } from "@/lib/queries";
import { requireAuth } from "@/lib/auth";
import NewFamilyView from "./NewFamilyView";

export default async function NewFamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const seasonId = params.season ? Number(params.season) : undefined;

  // 4주 이상 정체 새가족 자동 이탈 처리
  const { supabase } = await requireAuth();
  await markDroppedOutNewFamilies(supabase);

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
