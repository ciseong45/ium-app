export type AttendanceStatus = "present" | "absent" | "online";

export type AttendanceRecord = {
  id: number;
  member_id: number;
  week_date: string;
  status: AttendanceStatus;
};
