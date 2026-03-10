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
      <h2 className="text-xl font-semibold tracking-tight text-gray-900">설정</h2>
      <p className="mt-2 text-sm text-gray-500">
        사용자 역할과 멤버 연결을 관리합니다.
      </p>
      <SettingsView users={users} currentUserId={user.id} members={members} />
    </div>
  );
}
