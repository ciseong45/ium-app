/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/auth");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;

function createQueryMock(
  result: { data?: any; error?: any } = { data: null, error: null }
) {
  const mock: any = {};
  [
    "select", "insert", "update", "delete",
    "eq", "neq", "in", "not", "or", "ilike",
    "order", "gte", "lte", "single", "upsert", "limit", "is",
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

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

async function importActions() {
  return await import("../applications-actions");
}

beforeEach(() => jest.clearAllMocks());

// ===== getPool =====
describe("getPool", () => {
  it("시즌의 pending 신청 목록 반환", async () => {
    const { supabase } = setupAuth();
    const poolData = [
      { id: 1, season_id: 5, member_id: null, name: "김가을", phone: "010-0000-0001", status: "pending", source: "form", assigned_group_id: null, note: null, applied_at: "2026-06-01" },
    ];
    const q = createQueryMock({ data: poolData, error: null });
    supabase.from.mockReturnValue(q);

    const { getPool } = await importActions();
    const result = await getPool(5);

    expect(supabase.from).toHaveBeenCalledWith("small_group_applications");
    expect(q.eq).toHaveBeenCalledWith("season_id", 5);
    expect(q.eq).toHaveBeenCalledWith("status", "pending");
    expect(result).toEqual(poolData);
  });

  it("에러 시 빈 배열 반환", async () => {
    const { supabase } = setupAuth();
    const q = createQueryMock({ data: null, error: { message: "DB error" } });
    supabase.from.mockReturnValue(q);

    const { getPool } = await importActions();
    const result = await getPool(5);

    expect(result).toEqual([]);
  });
});

// ===== addApplication =====
describe("addApplication", () => {
  it("admin: 관리자 신청 추가 성공", async () => {
    const { supabase } = setupAuth("admin");
    const q = createQueryMock({ data: { id: 10 }, error: null });
    supabase.from.mockReturnValue(q);

    const { addApplication } = await importActions();
    const fd = makeFormData({ season_id: "5", name: "이봄", phone: "010-1111-2222", source: "admin" });
    const result = await addApplication(fd);

    expect(result.success).toBe(true);
    expect(q.insert).toHaveBeenCalledWith(
      expect.objectContaining({ season_id: 5, name: "이봄", source: "admin" })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/small-groups/5");
  });

  it("이름 없으면 에러", async () => {
    setupAuth("admin");
    const { addApplication } = await importActions();
    const fd = makeFormData({ season_id: "5", name: "", source: "admin" });
    const result = await addApplication(fd);
    expect(result).toEqual({ success: false, error: "이름은 필수입니다." });
  });

  it("season_id 없으면 에러", async () => {
    setupAuth("admin");
    const { addApplication } = await importActions();
    const fd = makeFormData({ name: "홍길동", source: "admin" });
    const result = await addApplication(fd);
    expect(result).toEqual({ success: false, error: "시즌 정보가 없습니다." });
  });

  it("group_leader는 추가 불가", async () => {
    setupAuth("group_leader");
    const { addApplication } = await importActions();
    const fd = makeFormData({ season_id: "5", name: "박여름", source: "admin" });
    const result = await addApplication(fd);
    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });
});

// ===== assignFromPool =====
describe("assignFromPool", () => {
  it("배정 성공: 신청 status assigned 업데이트만 수행", async () => {
    const { supabase } = setupAuth("admin");
    const updateMock = createQueryMock({ data: null, error: null });
    supabase.from.mockReturnValue(updateMock);

    const { assignFromPool } = await importActions();
    const result = await assignFromPool({
      applicationId: 1,
      groupId: 10,
      memberId: 42,
      seasonId: 5,
    });

    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).not.toHaveBeenCalledWith("small_group_members");
    expect(supabase.from).toHaveBeenCalledWith("small_group_applications");
    expect(updateMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "assigned", assigned_group_id: 10 })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/small-groups/5");
  });

  it("멤버 없는 신청(비회원)도 배정 가능 — member_id null일 때 small_group_members insert 생략", async () => {
    const { supabase } = setupAuth("admin");
    const updateMock = createQueryMock({ data: null, error: null });
    supabase.from.mockReturnValue(updateMock);

    const { assignFromPool } = await importActions();
    const result = await assignFromPool({
      applicationId: 2,
      groupId: 10,
      memberId: null,
      seasonId: 5,
    });

    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledTimes(1); // applications update만
    expect(supabase.from).not.toHaveBeenCalledWith("small_group_members");
  });

  it("group_leader는 배정 불가", async () => {
    setupAuth("group_leader");
    const { assignFromPool } = await importActions();
    const result = await assignFromPool({ applicationId: 1, groupId: 10, memberId: 1, seasonId: 5 });
    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("DB 에러 시 실패 반환", async () => {
    const { supabase } = setupAuth("admin");
    const errMock = createQueryMock({ data: null, error: { message: "insert failed" } });
    supabase.from.mockReturnValue(errMock);

    const { assignFromPool } = await importActions();
    const result = await assignFromPool({ applicationId: 1, groupId: 10, memberId: 42, seasonId: 5 });
    expect(result.success).toBe(false);
  });
});

// ===== cancelAssignment =====
describe("cancelAssignment", () => {
  it("배정 취소: small_group_members delete + status pending으로 복원", async () => {
    const { supabase } = setupAuth("admin");
    const deleteMock = createQueryMock({ data: null, error: null });
    const updateMock = createQueryMock({ data: null, error: null });
    let callCount = 0;
    supabase.from.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? deleteMock : updateMock;
    });

    const { cancelAssignment } = await importActions();
    const result = await cancelAssignment({
      applicationId: 1,
      groupId: 10,
      memberId: 42,
      seasonId: 5,
    });

    expect(result.success).toBe(true);
    expect(updateMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", assigned_group_id: null })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/small-groups/5");
  });

  it("member_id 없는 신청 취소 — small_group_members delete 생략", async () => {
    const { supabase } = setupAuth("admin");
    const updateMock = createQueryMock({ data: null, error: null });
    supabase.from.mockReturnValue(updateMock);

    const { cancelAssignment } = await importActions();
    const result = await cancelAssignment({ applicationId: 2, groupId: 10, memberId: null, seasonId: 5 });

    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});

// ===== cancelApplication =====
describe("cancelApplication", () => {
  it("신청 취소(cancelled) 처리", async () => {
    const { supabase } = setupAuth("admin");
    const q = createQueryMock({ data: null, error: null });
    supabase.from.mockReturnValue(q);

    const { cancelApplication } = await importActions();
    const result = await cancelApplication(1, 5);

    expect(result.success).toBe(true);
    expect(q.update).toHaveBeenCalledWith({ status: "cancelled" });
    expect(revalidatePath).toHaveBeenCalledWith("/small-groups/5");
  });

  it("group_leader는 취소 불가", async () => {
    setupAuth("group_leader");
    const { cancelApplication } = await importActions();
    const result = await cancelApplication(1, 5);
    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });
});
