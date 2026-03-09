export type OneToOneStatus = "active" | "completed" | "paused";

export type OneToOneEntry = {
  id: number;
  mentor: { id: number; name: string };
  mentee: { id: number; name: string };
  status: OneToOneStatus;
  started_at: string;
  completed_at: string | null;
};

export type SessionEntry = {
  id: number;
  one_to_one_id: number;
  session_date: string;
  session_number: number;
  notes: string | null;
};
