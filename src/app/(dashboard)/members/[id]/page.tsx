import { getMember, getStatusLog, getMemberLeaves } from "../actions";
import MemberDetail from "./MemberDetail";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [member, statusLog, leaves] = await Promise.all([
    getMember(Number(id)),
    getStatusLog(Number(id)),
    getMemberLeaves(Number(id)),
  ]);

  return <MemberDetail member={member} statusLog={statusLog} leaves={leaves} />;
}
