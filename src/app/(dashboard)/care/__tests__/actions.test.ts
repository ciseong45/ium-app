/* eslint-disable @typescript-eslint/no-explicit-any */

import { requireAuth } from "@/lib/auth";

jest.mock("@/lib/auth");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { getCareDashboard, recordCareFollowup } from "../actions";

const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function setup() {
  const rpc = jest.fn().mockResolvedValue({ data: "case-1", error: null });
  requireAuthMock.mockResolvedValue({
    supabase: { rpc } as any,
    user: { id: "leader-1" } as any,
    role: "group_leader",
    linkedMemberId: 7,
  });
  return rpc;
}

describe("pastoral care actions", () => {
  const caseId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => jest.clearAllMocks());

  it("다음 행동이 있으면 기한을 요구한다", async () => {
    setup();

    const result = await recordCareFollowup(17, form({
      contact_method: "message",
      outcome: "connected",
      note: "안부 확인",
      visibility: "assigned_leaders",
      next_action: "다음 주 식사 일정 확인",
      due_date: "",
    }));

    expect(result).toEqual({ success: false, error: "다음 행동의 확인 날짜를 입력해주세요." });
  });

  it("연락 결과와 다음 행동을 하나의 저장 요청으로 전달한다", async () => {
    const rpc = setup();

    const result = await recordCareFollowup(17, form({
      care_case_id: caseId,
      contact_method: "message",
      outcome: "awaiting_response",
      note: "  일정 확인 중  ",
      visibility: "assigned_leaders",
      next_action: "  금요일에 다시 확인  ",
      due_date: "2026-09-18",
    }));

    expect(result).toEqual({ success: true, data: { caseId: "case-1" } });
    expect(rpc).toHaveBeenCalledWith("record_care_followup", {
      p_member_id: 17,
      p_case_id: caseId,
      p_contact_method: "message",
      p_outcome: "awaiting_response",
      p_note: "일정 확인 중",
      p_visibility: "assigned_leaders",
      p_next_action: "금요일에 다시 확인",
      p_due_date: "2026-09-18",
    });
  });

  it("허용되지 않은 공개 범위를 거부한다", async () => {
    setup();

    const result = await recordCareFollowup(17, form({
      contact_method: "message",
      outcome: "connected",
      visibility: "everyone",
      next_action: "다음 만남 확인",
      due_date: "2026-09-18",
    }));

    expect(result).toEqual({ success: false, error: "사용할 수 없는 공개 범위입니다." });
  });

  it("이번 주 화면에서는 7일 안에 확인할 열린 돌봄만 조회한다", async () => {
    const limit = jest.fn().mockResolvedValue({ data: [], error: null });
    const query = {
      select: jest.fn(),
      neq: jest.fn(),
      lte: jest.fn(),
      order: jest.fn(),
      limit,
    };
    query.select.mockReturnValue(query);
    query.neq.mockReturnValue(query);
    query.lte.mockReturnValue(query);
    query.order.mockReturnValue(query);
    requireAuthMock.mockResolvedValue({
      supabase: { from: jest.fn().mockReturnValue(query) } as any,
      user: { id: "admin-1" } as any,
      role: "admin",
      linkedMemberId: null,
    });

    await getCareDashboard("2026-09-12");

    expect(query.lte).toHaveBeenCalledWith("due_date", "2026-09-19");
  });
});
