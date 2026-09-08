import { careCreateSchema, careChangeSchema, careCounts } from "@/lib/care";
const base = { memberId: 1, nextAction: "첫 방문 후 안부 확인", dueDate: "2026-09-15", assigneeId: null };
it("돌봄 조치에는 실제 날짜와 구체적인 할 일이 필요하다", () => {
  expect(careCreateSchema.safeParse(base).success).toBe(true);
  expect(careCreateSchema.safeParse({ ...base, dueDate: "2026-02-30" }).success).toBe(false);
  expect(careCreateSchema.safeParse({ ...base, nextAction: " " }).success).toBe(false);
});
it("완료·취소·보류에는 처리 근거가 필요하고 보류에는 다음 기한이 필요하다", () => {
  const change = { id: "00000000-0000-4000-8000-000000000001", version: 1, operation: "complete", note: "" };
  expect(careChangeSchema.safeParse(change).success).toBe(false);
  expect(careChangeSchema.safeParse({ ...change, note: "통화로 순장 소개 일정을 확인함" }).success).toBe(true);
  expect(careChangeSchema.safeParse({ ...change, operation: "wait", note: "다음 주 다시 연락" }).success).toBe(false);
});
it("완료한 일은 기한 초과와 미배정 수에서 제외된다", () => {
  expect(careCounts([
    { status: "completed", due_date: "2026-08-01", assigned_to: null, handoff_to: null },
    { status: "open", due_date: "2026-09-01", assigned_to: null, handoff_to: "me" },
    { status: "waiting", due_date: "2026-09-20", assigned_to: "me", handoff_to: null },
  ], "2026-09-08", "me")).toEqual({ open: 2, overdue: 1, unassigned: 1, mine: 1, handoffs: 1 });
});
