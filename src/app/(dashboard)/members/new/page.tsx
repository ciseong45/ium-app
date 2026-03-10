import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import MemberForm from "../MemberForm";

export default async function NewMemberPage() {
  const { role } = await requireAuth();
  if (role === "group_leader") redirect("/members");

  return (
    <div>
      <h2 className="font-serif text-2xl font-light tracking-tight text-[var(--color-warm-text)]">멤버 등록</h2>
      <p className="mt-2 text-sm text-[var(--color-warm-muted)]">새 멤버 정보를 입력하세요.</p>
      <div className="mt-6">
        <MemberForm />
      </div>
    </div>
  );
}
