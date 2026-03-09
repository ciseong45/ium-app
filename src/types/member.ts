export type MemberStatus = "active" | "attending" | "inactive" | "removed" | "on_leave";

export type Member = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  gender: "M" | "F" | null;
  birth_date: string | null;
  address: string | null;
  status: MemberStatus;
  kakao_id: string | null;
  is_baptized: boolean;
  school_or_work: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberGroupInfo = {
  group_id: number;
  group_name: string;
  leader_name: string | null;
};

export type MemberWithGroup = Member & {
  group_info?: MemberGroupInfo | null;
};

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "재적",
  attending: "출석",
  inactive: "미출석",
  removed: "제적",
  on_leave: "휴적",
};

export const STATUS_COLORS: Record<MemberStatus, string> = {
  active: "bg-green-100 text-green-700",
  attending: "bg-blue-100 text-blue-700",
  inactive: "bg-yellow-100 text-yellow-700",
  removed: "bg-red-100 text-red-700",
  on_leave: "bg-orange-100 text-orange-700",
};

export type LeaveType = "military" | "academic_leave" | "study_abroad" | "other";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  military: "군대",
  academic_leave: "휴학",
  study_abroad: "유학/교환학생",
  other: "기타",
};

export type MemberLeave = {
  id: number;
  member_id: number;
  leave_type: LeaveType;
  reason: string | null;
  start_date: string;
  expected_return: string | null;
  actual_return: string | null;
  created_at: string;
};
