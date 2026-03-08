import { getMember, getStatusLog } from "../actions";
import MemberDetail from "./MemberDetail";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await getMember(Number(id));
  const statusLog = await getStatusLog(Number(id));

  return <MemberDetail member={member} statusLog={statusLog} />;
}
