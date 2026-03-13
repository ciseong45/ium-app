import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { requireAuth, type UserRole } from "@/lib/auth";
import { RoleProvider } from "@/lib/RoleContext";

export default async function Layout({ children }: { children: React.ReactNode }) {
  let role: UserRole = "group_leader";

  try {
    const auth = await requireAuth();
    role = auth.role;
  } catch {
    redirect("/login");
  }

  return (
    <RoleProvider role={role}>
      <DashboardLayout>{children}</DashboardLayout>
    </RoleProvider>
  );
}
