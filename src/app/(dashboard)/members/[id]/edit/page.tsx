import { getMember } from "../../actions";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import MemberForm from "../../MemberForm";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [member, { role }] = await Promise.all([
    getMember(Number(id)),
    requireAuth(),
  ]);
  if (role === "group_leader") redirect("/members");
  if (!member) redirect("/members");

  return (
    <div>
      <h2 className="font-serif text-2xl font-light tracking-tight text-[var(--color-warm-text)]">멤버 수정</h2>
      <p className="mt-2 text-sm text-[var(--color-warm-muted)]">
        {member.last_name}{member.first_name}님의 정보를 수정합니다.
      </p>
      <div className="mt-6">
        <MemberForm member={member} />
      </div>
    </div>
  );
}
