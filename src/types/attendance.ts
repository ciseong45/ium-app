export type AttendanceStatus = "present" | "absent";

export type AttendanceRecord = {
  id: number;
  member_id: number;
  week_date: string;
  status: AttendanceStatus;
  prayer_request: boolean;
  prayer_note: string | null;
};
