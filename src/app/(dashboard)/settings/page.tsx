import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUsers, getLinkableMembers } from "./actions";
import SettingsView from "./SettingsView";

export default async function SettingsPage() {
  const { user, role } = await requireAuth();
  if (role !== "admin") redirect("/");

  const [users, members] = await Promise.all([getUsers(), getLinkableMembers()]);

  return (
    <div>
      <h2 className="font-serif text-2xl font-light tracking-tight text-[var(--color-warm-text)]">설정</h2>
      <p className="mt-2 text-sm text-[var(--color-warm-muted)]">
        사용자 역할과 멤버 연결을 관리합니다.
      </p>
      <SettingsView users={users} currentUserId={user.id} members={members} />
    </div>
  );
}
