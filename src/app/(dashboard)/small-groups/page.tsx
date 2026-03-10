import { getSeasons } from "./actions";
import SeasonList from "./SeasonList";

export default async function SmallGroupsPage() {
  const seasons = await getSeasons();

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">순관리</h2>
      <p className="mt-2 text-sm text-gray-500">
        시즌을 선택하면 순 편성을 관리할 수 있습니다.
      </p>
      <SeasonList seasons={seasons} />
    </div>
  );
}
