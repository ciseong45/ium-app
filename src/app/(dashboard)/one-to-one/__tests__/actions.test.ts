import { requireAuth } from "@/lib/auth";
import { fetchActiveMembers } from "@/lib/queries";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/auth");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/queries");

const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;

function createQueryMock(
  result: { data?: any; error?: any } = { data: null, error: null }
) {
  const mock: any = {};
  [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "in",
    "not",
    "or",
    "ilike",
    "order",
    "gte",
    "lte",
    "single",
    "upsert",
    "limit",
    "is",
  ].forEach((m) => {
    mock[m] = jest.fn().mockReturnValue(mock);
  });
  mock.then = (resolve: Function) => resolve(result);
  return mock;
}

function setupAuth(role = "admin") {
  const queryMock = createQueryMock();
  const supabase = { from: jest.fn().mockReturnValue(queryMock) };
  requireAuthMock.mockResolvedValue({
    supabase: supabase as any,
    user: { id: "user-1" } as any,
    role: role as any,
    linkedMemberId: 1,
  });
  return { supabase, queryMock };
}

import {
  createOneToOne,
  updateOneToOneStatus,
  deleteOneToOne,
  addSession,
  deleteSession,
} from "../actions";

describe("createOneToOne", () => {
  beforeEach(() => jest.clearAllMocks());

  it("group_leader는 권한 없음", async () => {
    setupAuth("group_leader");
    const fd = new FormData();
    fd.set("mentor_id", "1");
    fd.set("mentee_id", "2");

    const result = await createOneToOne(fd);
    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("멘토와 멘티가 비어있으면 에러", async () => {
    setupAuth("admin");
    const fd = new FormData();

    const result = await createOneToOne(fd);
    expect(result).toEqual({
      success: false,
      error: "멘토와 멘티를 선택해주세요.",
    });
  });

  it("멘토와 멘티가 같으면 에러", async () => {
    setupAuth("admin");
    const fd = new FormData();
    fd.set("mentor_id", "5");
    fd.set("mentee_id", "5");

    const result = await createOneToOne(fd);
    expect(result).toEqual({
      success: false,
      error: "멘토와 멘티는 다른 사람이어야 합니다.",
    });
  });

  it("정상 등록 성공", async () => {
    const { supabase, queryMock } = setupAuth("admin");
    const fd = new FormData();
    fd.set("mentor_id", "1");
    fd.set("mentee_id", "2");
    fd.set("started_at", "2026-01-01");

    const result = await createOneToOne(fd);

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("one_to_one");
    expect(queryMock.insert).toHaveBeenCalledWith({
      mentor_id: 1,
      mentee_id: 2,
      started_at: "2026-01-01",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/one-to-one");
  });
});

describe("updateOneToOneStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  it("group_leader는 권한 없음", async () => {
    setupAuth("group_leader");

    const result = await updateOneToOneStatus(1, "completed");
    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("completed 상태로 변경 시 completed_at 설정", async () => {
    const { queryMock } = setupAuth("admin");

    const result = await updateOneToOneStatus(1, "completed");

    expect(result).toEqual({ success: true });
    expect(queryMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        completed_at: expect.any(String),
      })
    );
    expect(queryMock.eq).toHaveBeenCalledWith("id", 1);
  });
});

describe("deleteOneToOne", () => {
  beforeEach(() => jest.clearAllMocks());

  it("admin만 삭제 가능", async () => {
    const { supabase, queryMock } = setupAuth("admin");

    const result = await deleteOneToOne(10);

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("one_to_one");
    expect(queryMock.delete).toHaveBeenCalled();
    expect(queryMock.eq).toHaveBeenCalledWith("id", 10);
    expect(revalidatePath).toHaveBeenCalledWith("/one-to-one");
  });

  it("non-admin은 권한 에러", async () => {
    setupAuth("upper_room_leader");

    const result = await deleteOneToOne(10);
    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });
});

describe("addSession", () => {
  beforeEach(() => jest.clearAllMocks());

  it("group_leader는 권한 없음", async () => {
    setupAuth("group_leader");
    const fd = new FormData();

    const result = await addSession(1, fd);
    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("다음 회차 번호 자동 계산", async () => {
    // 기존 세션이 있을 때: nextNumber = last + 1
    const existingSessionsMock = createQueryMock({
      data: [{ session_number: 3 }],
      error: null,
    });
    const insertMock = createQueryMock({ data: null, error: null });

    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        // from이 호출될 때마다 다른 mock 반환
        // 첫 번째: select (기존 세션 조회), 두 번째: insert (새 세션 추가)
        if (supabase.from.mock.calls.length <= 1) {
          return existingSessionsMock;
        }
        return insertMock;
      }),
    };

    requireAuthMock.mockResolvedValue({
      supabase: supabase as any,
      user: { id: "user-1" } as any,
      role: "admin" as any,
      linkedMemberId: 1,
    });

    const fd = new FormData();
    fd.set("session_date", "2026-03-01");
    fd.set("notes", "테스트 노트");

    const result = await addSession(5, fd);

    expect(result).toEqual({ success: true });
    expect(insertMock.insert).toHaveBeenCalledWith({
      one_to_one_id: 5,
      session_date: "2026-03-01",
      session_number: 4,
      notes: "테스트 노트",
    });
  });

  it("첫 세션일 때 session_number는 1", async () => {
    const emptySessionsMock = createQueryMock({
      data: [],
      error: null,
    });
    const insertMock = createQueryMock({ data: null, error: null });

    const supabase = {
      from: jest.fn().mockImplementation(() => {
        if (supabase.from.mock.calls.length <= 1) {
          return emptySessionsMock;
        }
        return insertMock;
      }),
    };

    requireAuthMock.mockResolvedValue({
      supabase: supabase as any,
      user: { id: "user-1" } as any,
      role: "admin" as any,
      linkedMemberId: 1,
    });

    const fd = new FormData();
    fd.set("session_date", "2026-03-01");

    const result = await addSession(5, fd);

    expect(result).toEqual({ success: true });
    expect(insertMock.insert).toHaveBeenCalledWith({
      one_to_one_id: 5,
      session_date: "2026-03-01",
      session_number: 1,
      notes: null,
    });
  });
});

describe("deleteSession", () => {
  beforeEach(() => jest.clearAllMocks());

  it("admin만 삭제 가능", async () => {
    const { supabase, queryMock } = setupAuth("admin");

    const result = await deleteSession(99);

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("one_to_one_sessions");
    expect(queryMock.delete).toHaveBeenCalled();
    expect(queryMock.eq).toHaveBeenCalledWith("id", 99);
    expect(revalidatePath).toHaveBeenCalledWith("/one-to-one");
  });
});
