import { getSongs } from "./actions";
import SongLibraryView from "./SongLibraryView";

export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const songs = await getSongs(params.q);

  return <SongLibraryView songs={songs} searchQuery={params.q || ""} />;
}
