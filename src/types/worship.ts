// --- Worship Position Types ---

export type WorshipPosition = {
  id: number;
  name: string;
  display_order: number;
};

export type MemberPosition = {
  id: number;
  member_id: number;
  position_id: number;
  is_capable: boolean;
};

// --- Worship Attendance Types ---

export type WorshipAttendanceRecord = {
  id: number;
  member_id: number;
  week_date: string;
  is_present: boolean;
  absence_reason: string | null;
  created_at: string;
};

export const ABSENCE_REASONS = [
  "알바",
  "한국",
  "아픔",
  "시험",
  "여행",
  "외부사역",
  "기타",
] as const;

export type AbsenceReason = (typeof ABSENCE_REASONS)[number];

// --- Worship Lineup Types ---

export type WorshipLineup = {
  id: number;
  service_date: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type WorshipLineupSlot = {
  id: number;
  lineup_id: number;
  position_id: number;
  member_id: number;
  slot_order: number;
};

// --- Worship Conti Types ---

export type ServiceType = "주일" | "금요" | "수련회" | "특별" | "기타";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  주일: "주일예배",
  금요: "금요예배",
  수련회: "수련회",
  특별: "특별예배",
  기타: "기타",
};

export const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  주일: "bg-[#edf5ed] text-[#3d6b3d]",
  금요: "bg-[#ede8f5] text-[#5b47a0]",
  수련회: "bg-[#fef3e8] text-[#b05a20]",
  특별: "bg-[#f0edf8] text-[#6b4fa5]",
  기타: "bg-[#f5f0e0] text-[#8a7a56]",
};

export type WorshipConti = {
  id: number;
  service_date: string;
  leader_member_id: number | null;
  service_type: ServiceType;
  theme: string | null;
  notes: string | null;
  scripture: string | null;
  description: string | null;
  discussion_questions: string | null;
  created_at: string;
  updated_at: string;
};

export type ContiSong = {
  id: number;
  conti_id: number;
  song_order: number;
  title: string;
  song_key: string | null;
  notes: string | null;
  bpm: number | null;
  time_signature: string | null;
  artist: string | null;
  reference_url: string | null;
  song_form: string | null;
  session_notes: string | null;
  singer_notes: string | null;
  engineer_notes: string | null;
  sheet_music_url: string | null;
};

export type Song = {
  id: number;
  title: string;
  artist: string | null;
  default_key: string | null;
};

// --- Worship Member Schedule Types ---

export type ScheduleType = "off" | "oot" | "etc";

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  off: "Off",
  oot: "OOT",
  etc: "기타",
};

export const SCHEDULE_TYPE_COLORS: Record<ScheduleType, string> = {
  off: "bg-[#fef3e8] text-[#b05a20]",
  oot: "bg-[#ede8f5] text-[#5b47a0]",
  etc: "bg-[#f5f0e0] text-[#8a7a56]",
};

export type WorshipMemberSchedule = {
  id: number;
  member_id: number;
  start_date: string;
  end_date: string;
  type: ScheduleType;
  note: string | null;
  created_at: string;
};

// --- View Types (joined data) ---

export type WorshipMemberWithPositions = {
  member_id: number;
  last_name: string;
  first_name: string;
  positions: { position_id: number; is_capable: boolean }[];
};

export type LineupSlotWithMember = WorshipLineupSlot & {
  member_last_name: string;
  member_first_name: string;
  position_name: string;
};
