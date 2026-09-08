import { z } from "zod";
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + "T00:00:00Z");
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "올바른 날짜를 입력하세요.");
export const careCreateSchema = z.object({
  memberId: z.number().int().positive(), nextAction: z.string().trim().min(1).max(500),
  dueDate: dateSchema, assigneeId: z.string().uuid().nullable(),
});
export const careChangeSchema = z.object({
  id: z.string().uuid(), version: z.number().int().positive(),
  operation: z.enum(["complete", "wait", "reopen", "cancel", "handoff", "accept", "decline"]),
  note: z.string().trim().max(2000).default(""), targetId: z.string().uuid().nullable().optional(),
  dueDate: dateSchema.optional(),
}).superRefine((value, ctx) => {
  if (!["accept"].includes(value.operation) && !value.note) ctx.addIssue({ code: "custom", message: "처리 내용을 입력하세요.", path: ["note"] });
  if (["wait", "reopen"].includes(value.operation) && !value.dueDate) ctx.addIssue({ code: "custom", message: "다음 기한을 입력하세요.", path: ["dueDate"] });
  if (value.operation === "handoff" && !value.targetId) ctx.addIssue({ code: "custom", message: "인계받을 담당자를 선택하세요.", path: ["targetId"] });
});
export type CareAction = {
  id: string; member_id: number; next_action: string; due_date: string;
  status: "open" | "waiting" | "completed" | "cancelled";
  assigned_to: string | null; handoff_to: string | null; created_by: string; version: number;
  created_at: string; updated_at: string;
  member: { last_name: string; first_name: string } | null;
};
export type CareEvent = { id: number; action_id: string; actor_id: string; operation: string; note: string; created_at: string };
export type CarePerson = { id: string; name: string };
export const CARE_STATUS = { open: "진행 중", waiting: "응답 대기", completed: "완료", cancelled: "취소" };
export const CARE_EVENT: Record<string, string> = { create: "등록", complete: "완료", wait: "응답 대기", reopen: "다시 진행", cancel: "취소", handoff: "인계 요청", accept: "인계 수락", decline: "인계 거절" };
export function careCounts(actions: Pick<CareAction, "status" | "due_date" | "assigned_to" | "handoff_to">[], today: string, userId: string) {
  const open = actions.filter(a => a.status === "open" || a.status === "waiting");
  return { open: open.length, overdue: open.filter(a => a.due_date < today).length,
    unassigned: open.filter(a => !a.assigned_to).length, mine: open.filter(a => a.assigned_to === userId).length,
    handoffs: open.filter(a => a.handoff_to === userId).length };
}
