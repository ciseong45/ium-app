export type Season = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type NewFamilyEntry = {
  id: number;
  member_id: number;
  first_visit: string;
  step: number;
  step_updated_at: string;
  assigned_to: number | null;
  season_id: number | null;
  notes: string | null;
  dropped_out: boolean;
  dropped_out_at: string | null;
  registered_at?: string | null;
  registered_by?: string | null;
  registration_source?: "confirmed" | "legacy" | null;
  enrollments?: EducationEnrollment[];
  created_at: string;
  member: {
    id: number;
    last_name: string;
    first_name: string;
    phone: string | null;
    status: string;
  };
  assignee: { id: number; last_name: string; first_name: string } | null;
};

export type EducationStatus = "scheduled" | "in_progress" | "completed";
export type EducationCourse = {
  id: number;
  season_id: number;
  name: string;
  starts_on: string;
  total_weeks?: number;
};
export type EducationEnrollment = {
  id: number;
  course_id: number;
  status: EducationStatus;
  completed_at: string | null;
  current_week?: number | null;
};
