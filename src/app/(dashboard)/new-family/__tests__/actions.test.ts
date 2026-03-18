/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from "@/lib/auth";
import { insertStatusLog } from "@/lib/queries";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/auth");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/queries");

const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;
const insertStatusLogMock = insertStatusLog as jest.MockedFunction<
  typeof insertStatusLog
>;

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
  mock.then = (resolve: (value: unknown) => void) => resolve(result);
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

// 동적 import — jest.mock 호이스팅 이후에 로드
let createNewFamily: typeof import("../actions").createNewFamily;
let updateStep: typeof import("../actions").updateStep;
let updateAssignee: typeof import("../actions").updateAssignee;
let deleteNewFamily: typeof import("../actions").deleteNewFamily;

beforeAll(async () => {
  const mod = await import("../actions");
  createNewFamily = mod.createNewFamily;
  updateStep = mod.updateStep;
  updateAssignee = mod.updateAssignee;
  deleteNewFamily = mod.deleteNewFamily;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── createNewFamily ────────────────────────────────────────────────

describe("createNewFamily", () => {
  function makeFormData(fields: Record<string, string>) {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    return fd;
  }

  it("group_leader는 권한 없음", async () => {
    setupAuth("group_leader");
    const result = await createNewFamily(makeFormData({}));
    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("성과 이름이 없으면 에러", async () => {
    setupAuth("admin");
    const result = await createNewFamily(
      makeFormData({ first_visit: "2026-01-01" })
    );
    expect(result).toEqual({
      success: false,
      error: "성과 이름은 필수입니다.",
    });
  });

  it("첫 방문일이 없으면 에러", async () => {
    setupAuth("admin");
    const result = await createNewFamily(
      makeFormData({ last_name: "김", first_name: "철수" })
    );
    expect(result).toEqual({
      success: false,
      error: "첫 방문일은 필수입니다.",
    });
  });

  it("정상 등록 성공", async () => {
    // members.insert → select → single 에서 { id: 10 } 반환
    const memberInsertMock = createQueryMock({
      data: { id: 10 },
      error: null,
    });
    // small_group_seasons.select → eq → single 에서 { id: 5 } 반환
    const seasonMock = createQueryMock({ data: { id: 5 }, error: null });
    // new_family.insert 에서 성공
    const newFamilyInsertMock = createQueryMock({ data: null, error: null });

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "members") return memberInsertMock;
        if (table === "small_group_seasons") return seasonMock;
        if (table === "new_family") return newFamilyInsertMock;
        return createQueryMock();
      }),
    };

    requireAuthMock.mockResolvedValue({
      supabase: supabase as any,
      user: { id: "user-1" } as any,
      role: "admin" as any,
      linkedMemberId: 1,
    });

    const result = await createNewFamily(
      makeFormData({
        last_name: "김",
        first_name: "철수",
        first_visit: "2026-01-01",
        assigned_to: "3",
      })
    );

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("members");
    expect(supabase.from).toHaveBeenCalledWith("new_family");
    expect(revalidatePath).toHaveBeenCalledWith("/new-family");
  });
});

// ─── updateStep ─────────────────────────────────────────────────────

describe("updateStep", () => {
  it("group_leader는 권한 없음", async () => {
    setupAuth("group_leader");
    const result = await updateStep(1, 2);
    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("잘못된 단계(0, 4)면 에러", async () => {
    setupAuth("admin");

    const result0 = await updateStep(1, 0);
    expect(result0).toEqual({ success: false, error: "잘못된 단계입니다." });

    const result4 = await updateStep(1, 4);
    expect(result4).toEqual({ success: false, error: "잘못된 단계입니다." });
  });

  it("3주차 완료 시 상태가 adjusting으로 전환", async () => {
    // new_family.update → eq 성공
    const updateMock = createQueryMock({ data: null, error: null });
    // new_family.select("member_id") → eq → single → { member_id: 10 }
    const familySelectMock = createQueryMock({
      data: { member_id: 10 },
      error: null,
    });
    // members.select("status") → eq → single → { status: "new_family" }
    const memberSelectMock = createQueryMock({
      data: { status: "new_family" },
      error: null,
    });
    // members.update({ status: "adjusting" }) → eq 성공
    const memberUpdateMock = createQueryMock({ data: null, error: null });

    let newFamilyCallCount = 0;
    let membersCallCount = 0;

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "new_family") {
          newFamilyCallCount++;
          // 첫 호출: update (step 변경), 두 번째: select (member_id 조회)
          return newFamilyCallCount === 1 ? updateMock : familySelectMock;
        }
        if (table === "members") {
          membersCallCount++;
          // 첫 호출: select (status 조회), 두 번째: update (status 변경)
          return membersCallCount === 1 ? memberSelectMock : memberUpdateMock;
        }
        return createQueryMock();
      }),
    };

    requireAuthMock.mockResolvedValue({
      supabase: supabase as any,
      user: { id: "user-1" } as any,
      role: "admin" as any,
      linkedMemberId: 1,
    });

    insertStatusLogMock.mockResolvedValue(undefined);

    const result = await updateStep(1, 3);

    expect(result).toEqual({ success: true });

    // members 테이블에 status: "adjusting" 업데이트 확인
    expect(memberUpdateMock.update).toHaveBeenCalledWith({
      status: "adjusting",
    });

    // insertStatusLog 호출 확인
    expect(insertStatusLogMock).toHaveBeenCalledWith(
      supabase,
      10,
      "new_family",
      "adjusting",
      "user-1"
    );

    expect(revalidatePath).toHaveBeenCalledWith("/new-family");
    expect(revalidatePath).toHaveBeenCalledWith("/members");
  });
});

// ─── updateAssignee ─────────────────────────────────────────────────

describe("updateAssignee", () => {
  it("group_leader는 권한 없음", async () => {
    setupAuth("group_leader");
    const result = await updateAssignee(1, 2);
    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("정상 담당자 변경", async () => {
    const { supabase, queryMock } = setupAuth("admin");

    const result = await updateAssignee(1, 5);

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("new_family");
    expect(queryMock.update).toHaveBeenCalledWith({ assigned_to: 5 });
    expect(queryMock.eq).toHaveBeenCalledWith("id", 1);
    expect(revalidatePath).toHaveBeenCalledWith("/new-family");
  });
});

// ─── deleteNewFamily ────────────────────────────────────────────────

describe("deleteNewFamily", () => {
  it("admin만 삭제 가능", async () => {
    const { supabase, queryMock } = setupAuth("admin");

    const result = await deleteNewFamily(1);

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("new_family");
    expect(queryMock.delete).toHaveBeenCalled();
    expect(queryMock.eq).toHaveBeenCalledWith("id", 1);
    expect(revalidatePath).toHaveBeenCalledWith("/new-family");
  });

  it("non-admin은 권한 에러", async () => {
    setupAuth("group_leader");

    const result = await deleteNewFamily(1);
    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });
});
