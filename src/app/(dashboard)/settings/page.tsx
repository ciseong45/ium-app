import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUsers } from "./actions";
import SettingsView from "./SettingsView";

export default async function SettingsPage() {
  const { user, role } = await requireAuth();
  if (role !== "admin") redirect("/");

  const users = await getUsers();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">설정</h2>
      <p className="mt-2 text-sm text-gray-500">
        사용자 역할을 관리합니다.
      </p>
      <SettingsView users={users} currentUserId={user.id} />
    </div>
  );
}
