import type { Member } from "./member";

export type UpperRoom = {
  id: number;
  season_id: number;
  name: string;
  leader_id: number | null;
  leader: { id: number; last_name: string; first_name: string } | null;
  display_order: number;
};

export type SmallGroup = {
  id: number;
  name: string;
  season_id: number;
  upper_room_id: number;
  leader: { id: number; last_name: string; first_name: string } | null;
};

export type GroupMemberApplication = {
  id: number;
  member_id: number | null;
  name: string;
  phone: string | null;
  source: "form" | "admin";
  note: string | null;
  applied_at: string;
};

export type GroupMemberEntry =
  | {
      id: number;
      group_id: number;
      kind?: "member";
      member: Member;
    }
  | {
      id: number;
      group_id: number;
      kind: "application";
      application: GroupMemberApplication;
    };
