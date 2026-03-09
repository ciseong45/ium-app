import type { Member } from "./member";

export type UpperRoom = {
  id: number;
  season_id: number;
  name: string;
  leader_id: number | null;
  leader: { id: number; name: string } | null;
  display_order: number;
};

export type SmallGroup = {
  id: number;
  name: string;
  season_id: number;
  upper_room_id: number;
  leader: { id: number; name: string } | null;
};

export type GroupMemberEntry = {
  id: number;
  group_id: number;
  member: Member;
};
