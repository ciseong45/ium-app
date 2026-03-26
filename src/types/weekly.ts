export type WeeklyBriefStatus = "draft" | "published";

export type WeeklyBrief = {
  id: number;
  week_date: string;
  title: string | null;
  sermon_title: string | null;
  sermon_scripture: string | null;
  common_content: Record<string, unknown>;
  worship_content: Record<string, unknown>;
  media_content: Record<string, unknown>;
  newfamily_content: Record<string, unknown>;
  smallgroup_content: Record<string, unknown>;
  status: WeeklyBriefStatus;
  created_at: string;
  updated_at: string;
};

export const BRIEF_STATUS_LABELS: Record<WeeklyBriefStatus, string> = {
  draft: "초안",
  published: "발행",
};

export const BRIEF_STATUS_COLORS: Record<WeeklyBriefStatus, string> = {
  draft: "bg-[#fef3e8] text-[#b05a20]",
  published: "bg-[#edf5ed] text-[#3d6b3d]",
};

export const BRIEF_TABS = [
  { key: "common", label: "공통" },
  { key: "worship", label: "찬양팀" },
  { key: "media", label: "미디어팀" },
  { key: "newfamily", label: "새가족팀" },
  { key: "smallgroup", label: "순사역" },
] as const;

export type BriefTabKey = (typeof BRIEF_TABS)[number]["key"];
