export type MemberStatus = "active" | "attending" | "inactive" | "removed";

export type Member = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  gender: "M" | "F" | null;
  birth_date: string | null;
  address: string | null;
  status: MemberStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "재적",
  attending: "출석",
  inactive: "미출석",
  removed: "제적",
};

export const STATUS_COLORS: Record<MemberStatus, string> = {
  active: "bg-green-100 text-green-700",
  attending: "bg-blue-100 text-blue-700",
  inactive: "bg-yellow-100 text-yellow-700",
  removed: "bg-red-100 text-red-700",
};
