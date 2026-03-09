"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/lib/auth";

const RoleContext = createContext<UserRole>("viewer");

export function RoleProvider({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
