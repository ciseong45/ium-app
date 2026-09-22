import { requireAuth } from "@/lib/auth";
import {
  createNewFamily,
  confirmRegistration,
  updateEducation,
  restoreNewFamily,
  updateStep,
  createCourse,
  updateEducationProgress,
} from "../actions";
jest.mock("@/lib/auth");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const rpc = jest.fn();
const insert = jest.fn();
const from = jest.fn(() => ({ insert }));
function setup(role = "admin") {
  (requireAuth as jest.Mock).mockResolvedValue({
    supabase: { rpc, from },
    user: { id: "user-1" },
    role,
  });
  rpc.mockResolvedValue({ error: null });
  insert.mockResolvedValue({ error: null });
}
beforeEach(() => {
  jest.clearAllMocks();
  setup();
});
function form(values: Record<string, string>) {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => fd.set(k, v));
  return fd;
}
it("접수는 방문·새가족순을 한 트랜잭션으로 생성한다", async () => {
  expect(
    await createNewFamily(
      form({ last_name: "김", first_name: "방문", first_visit: "2026-09-19" }),
    ),
  ).toEqual({ success: true });
  expect(rpc).toHaveBeenCalledWith("receive_new_family", {
    p_data: expect.objectContaining({ last_name: "김", first_name: "방문" }),
  });
  expect(from).not.toHaveBeenCalled();
});
it("접수 실패를 성공으로 반환하지 않는다", async () => {
  rpc.mockResolvedValue({ error: { message: "no season" } });
  expect(
    (
      await createNewFamily(
        form({
          last_name: "김",
          first_name: "방문",
          first_visit: "2026-09-19",
        }),
      )
    ).success,
  ).toBe(false);
});
it("교육 이수는 등록 확정 요청을 보내지 않는다", async () => {
  expect(await updateEducation(1, 2, "completed")).toEqual({ success: true });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("new_family_manage", {
    p_family_id: 1,
    p_action: "education",
    p_course_id: 2,
    p_status: "completed",
  });
  expect(from).not.toHaveBeenCalled();
});
it("정식 등록은 DB의 이수·권한 확인과 감사 기록을 함께 실행한다", async () => {
  expect(await confirmRegistration(1)).toEqual({ success: true });
  expect(rpc).toHaveBeenCalledWith("new_family_manage", {
    p_family_id: 1,
    p_action: "register",
  });
});
it("등록 조건 불충족은 실패로 표시한다", async () => {
  rpc.mockResolvedValue({ error: { message: "not eligible" } });
  expect((await confirmRegistration(1)).success).toBe(false);
});
it("순장 권한은 교육 및 정식 등록을 확정할 수 없다", async () => {
  setup("group_leader");
  expect((await confirmRegistration(1)).success).toBe(false);
  expect((await updateEducation(1, 2, "completed")).success).toBe(false);
  expect((await createCourse(form({}))).success).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});
it("유효하지 않은 대상과 교육 차수는 DB 호출 전에 거부한다", async () => {
  expect((await confirmRegistration(NaN)).success).toBe(false);
  expect((await updateEducation(1, 0, "completed")).success).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it("구버전 주차 버튼은 상태를 변경하지 않는다", async () => {
  expect((await updateStep(1, 3)).success).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});
it("복귀 시 교육 진도와 등록 상태를 초기화하지 않는다", async () => {
  expect(await restoreNewFamily(1)).toEqual({ success: true });
  expect(rpc).toHaveBeenCalledWith("new_family_manage", {
    p_family_id: 1,
    p_action: "restore",
  });
  expect(from).not.toHaveBeenCalled();
});

it("교육 주차 저장과 수료는 정식 등록과 별도 요청이다", async () => {
  expect(await updateEducationProgress(1, 2, 3, false)).toEqual({
    success: true,
  });
  expect(rpc).toHaveBeenCalledWith("new_family_set_progress", {
    p_family_id: 1,
    p_course_id: 2,
    p_week: 3,
    p_complete: false,
  });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("교육 주차는 정수만 허용하고 순장 수정은 거부한다", async () => {
  for (const week of [0, -1, 1.5, 53, NaN])
    expect((await updateEducationProgress(1, 2, week, false)).success).toBe(
      false,
    );
  setup("group_leader");
  expect((await updateEducationProgress(1, 2, 1, false)).success).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
