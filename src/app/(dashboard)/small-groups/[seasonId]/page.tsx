import {
  getSeasons,
  getGroupsBySeason,
  getUnassignedMembers,
} from "../actions";
import SeasonDetail from "./SeasonDetail";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const { seasonId } = await params;
  const id = Number(seasonId);

  const [seasons, groups, unassigned] = await Promise.all([
    getSeasons(),
    getGroupsBySeason(id),
    getUnassignedMembers(id),
  ]);

  const season = seasons.find((s) => s.id === id);
  if (!season) {
    return <p className="text-gray-500">시즌을 찾을 수 없습니다.</p>;
  }

  return (
    <SeasonDetail season={season} groups={groups} unassignedMembers={unassigned} />
  );
}
