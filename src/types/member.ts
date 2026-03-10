export type MemberStatus = "active" | "attending" | "inactive" | "removed" | "on_leave" | "new_family" | "adjusting";

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
  upper_room_id: number;
  upper_room_name: string;
};

// --- Ministry Team Types ---

export type MinistryTeamCategory = "worship" | "discipleship";

export type MinistryTeam = {
  id: number;
  name: string;
  category: MinistryTeamCategory;
  display_order: number;
};

export const MINISTRY_CATEGORY_LABELS: Record<MinistryTeamCategory, string> = {
  worship: "예배사역",
  discipleship: "순사역",
};

export const MINISTRY_TEAM_COLORS: Record<MinistryTeamCategory, string> = {
  worship: "bg-[#ede8f5] text-[#5b47a0]",
  discipleship: "bg-[#edf5ed] text-[#3d6b3d]",
};

export type MemberWithGroup = Member & {
  group_info?: MemberGroupInfo | null;
  ministry_teams?: MinistryTeam[];
};

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "재적",
  attending: "출석",
  inactive: "미출석",
  removed: "제적",
  on_leave: "휴적",
  new_family: "새가족",
  adjusting: "적응중",
};

export const STATUS_COLORS: Record<MemberStatus, string> = {
  active: "bg-[#edf5ed] text-[#3d6b3d]",
  attending: "bg-[var(--color-warm-bg)] text-[var(--color-warm-text)]",
  inactive: "bg-[#f5f0e0] text-[#8a7a56]",
  removed: "bg-rose-50 text-rose-600",
  on_leave: "bg-[#fef3e8] text-[#b05a20]",
  new_family: "bg-[#f0edf8] text-[#6b4fa5]",
  adjusting: "bg-[#edf5f3] text-[#3d6b5d]",
};

// --- 메인/보조 상태 체계 ---

// 인라인 편집 드롭다운용 메인 상태 옵션
export const MAIN_STATUS_OPTIONS: { value: MemberStatus; label: string }[] = [
  { value: "active", label: "재적" },
  { value: "removed", label: "제적" },
  { value: "on_leave", label: "휴적" },
  { value: "new_family", label: "새가족" },
];

// 상태 → 메인상태 표시용
export function getMainStatus(status: MemberStatus): { label: string; color: string } {
  switch (status) {
    case "removed":
      return { label: "제적", color: STATUS_COLORS.removed };
    case "on_leave":
      return { label: "휴적", color: STATUS_COLORS.on_leave };
    case "new_family":
      return { label: "새가족", color: STATUS_COLORS.new_family };
    default: // active, attending, inactive, adjusting → 모두 "재적"
      return { label: "재적", color: STATUS_COLORS.active };
  }
}

// 보조상태 (있으면 반환, 없으면 null)
export function getSubStatus(status: MemberStatus): { label: string; color: string } | null {
  if (status === "adjusting") {
    return { label: "적응중", color: STATUS_COLORS.adjusting };
  }
  return null;
}

// 학교 목록
export const COMMON_SCHOOLS = [
  "NEU", "BU", "Boston College", "MCPHS", "Berklee", "MIT", "Harvard", "Wellesley", "NEC",
];

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
