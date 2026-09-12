export type CareCaseType = "welcome" | "new_family" | "connection" | "general_care" | "long_absence";
export type CareCaseStatus = "open" | "awaiting_response" | "paused" | "closed";
export type CareVisibility = "assigned_leaders" | "pastoral_only";
export type CareContactMethod = "message" | "phone" | "in_person" | "other";
export type CareContactOutcome = "connected" | "awaiting_response" | "scheduling";

export type CareDashboardItem = {
  id: string;
  memberId: number;
  memberName: string;
  caseType: CareCaseType;
  status: CareCaseStatus;
  nextAction: string;
  dueDate: string;
  assigneeName: string;
  lastContactAt: string | null;
};

export type CareLogItem = {
  id: string;
  careCaseId: string;
  contactedAt: string;
  authorName: string;
  contactMethod: CareContactMethod;
  outcome: CareContactOutcome;
  note: string | null;
  visibility: CareVisibility;
};

export type CareDashboardData = { items: CareDashboardItem[]; errors: string[] };
export type MemberCareData = { openCases: CareDashboardItem[]; logs: CareLogItem[]; errors: string[] };
