import { getNewFamilies, getActiveMembers } from "./actions";
import NewFamilyView from "./NewFamilyView";

export default async function NewFamilyPage() {
  const [families, members] = await Promise.all([
    getNewFamilies(),
    getActiveMembers(),
  ]);

  return <NewFamilyView families={families} members={members} />;
}
