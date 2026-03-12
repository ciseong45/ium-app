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
  created_at: string;
  member: { id: number; last_name: string; first_name: string; phone: string | null };
  assignee: { id: number; last_name: string; first_name: string } | null;
};
