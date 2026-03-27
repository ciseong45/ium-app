import { getRecentContis } from "./actions";
import ContiListView from "./ContiListView";

export default async function ContiPage() {
  const contis = await getRecentContis(50);

  return <ContiListView contis={contis} />;
}
