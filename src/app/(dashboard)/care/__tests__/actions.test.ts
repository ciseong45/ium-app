import { createCareAction, changeCareAction } from "../actions";
import { requireAuth } from "@/lib/auth";
jest.mock("@/lib/auth");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const id = "00000000-0000-4000-8000-000000000001";
const rpc = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (requireAuth as jest.Mock).mockResolvedValue({ supabase: { rpc }, user: { id }, role: "admin" });
  rpc.mockResolvedValue({ error: null });
});
it("돌봄 등록은 관리자만 시작할 수 있다", async () => {
  (requireAuth as jest.Mock).mockResolvedValue({ supabase: { rpc }, role: "group_leader" });
  expect((await createCareAction({ memberId: 1, nextAction: "안부 확인", dueDate: "2026-09-15", assigneeId: id })).success).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it("유효한 등록을 원자적 RPC에 전달한다", async () => {
  expect((await createCareAction({ memberId: 1, nextAction: "안부 확인", dueDate: "2026-09-15", assigneeId: id })).success).toBe(true);
  expect(rpc).toHaveBeenCalledWith("create_care_action", expect.objectContaining({ p_member_id: 1, p_assignee: id }));
});
it("근거 없는 완료는 저장 요청을 보내지 않는다", async () => {
  expect((await changeCareAction({ id, version: 1, operation: "complete", note: "" })).success).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it("충돌 시 새로고침을 안내하고 성공으로 표시하지 않는다", async () => {
  rpc.mockResolvedValue({ error: { message: "CARE_CONFLICT" } });
  expect(await changeCareAction({ id, version: 1, operation: "accept" })).toEqual({ success: false, error: expect.stringContaining("새로고침") });
});
