import DashboardLayout from "@/components/DashboardLayout";
import { requireAuth } from "@/lib/auth";
import { RoleProvider } from "@/lib/RoleContext";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { role } = await requireAuth();

  return (
    <RoleProvider role={role}>
      <DashboardLayout>{children}</DashboardLayout>
    </RoleProvider>
  );
}
