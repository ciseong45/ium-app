import { getMember, getStatusLog, getMemberLeaves, getMemberGroupInfo, getNewFamilyEntry } from "../actions";
import MemberDetail from "./MemberDetail";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const memberId = Number(id);
  const [member, statusLog, leaves, groupInfo, newFamilyEntry] = await Promise.all([
    getMember(memberId),
    getStatusLog(memberId),
    getMemberLeaves(memberId),
    getMemberGroupInfo(memberId),
    getNewFamilyEntry(memberId),
  ]);

  return (
    <MemberDetail
      member={member}
      statusLog={statusLog}
      leaves={leaves}
      groupInfo={groupInfo}
      newFamilyEntry={newFamilyEntry}
    />
  );
}
