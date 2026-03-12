import { getMember, getStatusLog, getMemberLeaves, getMemberGroupInfo, getNewFamilyEntry, getMemberMinistryTeams } from "../actions";
import { redirect } from "next/navigation";
import MemberDetail from "./MemberDetail";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const memberId = Number(id);
  const [memberOrNull, statusLog, leaves, groupInfo, newFamilyEntry, ministryTeams] = await Promise.all([
    getMember(memberId),
    getStatusLog(memberId),
    getMemberLeaves(memberId),
    getMemberGroupInfo(memberId),
    getNewFamilyEntry(memberId),
    getMemberMinistryTeams(memberId),
  ]);

  if (!memberOrNull) redirect("/members");
  const member = memberOrNull;

  return (
    <MemberDetail
      member={member}
      statusLog={statusLog}
      leaves={leaves}
      groupInfo={groupInfo}
      newFamilyEntry={newFamilyEntry}
      ministryTeams={ministryTeams}
    />
  );
}
