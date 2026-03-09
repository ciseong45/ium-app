import type { UserRole } from "@/lib/auth";

export type UserEntry = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: string;
};
