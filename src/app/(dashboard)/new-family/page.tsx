import {
  getNewFamilies,
  getActiveMembers,
  getSeasons,
  getCourses,
} from "./actions";
import { requireAuth } from "@/lib/auth";
import NewFamilyView from "./NewFamilyView";

export default async function NewFamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const seasonId = params.season ? Number(params.season) : undefined;

  const { linkedMemberId } = await requireAuth();
  const [families, members, seasons, courses] = await Promise.all([
    getNewFamilies(),
    getActiveMembers(),
    getSeasons(),
    getCourses(),
  ]);

  return (
    <NewFamilyView
      families={families}
      courses={courses}
      myMemberId={linkedMemberId}
      members={members}
      seasons={seasons}
      currentSeasonId={seasonId}
    />
  );
}
