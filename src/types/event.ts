export type EventType = "수련회" | "연합예배" | "캠프" | "특별예배" | "기타";

export type ChurchEvent = {
  id: number;
  name: string;
  event_type: EventType;
  start_date: string;
  end_date: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  수련회: "수련회",
  연합예배: "연합예배",
  캠프: "캠프",
  특별예배: "특별예배",
  기타: "기타",
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  수련회: "bg-[#fef3e8] text-[#b05a20]",
  연합예배: "bg-[#ede8f5] text-[#5b47a0]",
  캠프: "bg-[#edf5ed] text-[#3d6b3d]",
  특별예배: "bg-[#f0edf8] text-[#6b4fa5]",
  기타: "bg-[#f5f0e0] text-[#8a7a56]",
};
