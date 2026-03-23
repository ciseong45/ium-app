/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from "@/lib/auth";

jest.mock("@/lib/auth");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import {
  getUsers,
  getLinkableMembers,
  updateUserRole,
  linkMemberToUser,
  deleteUser,
  updateUserName,
} from "../actions";

const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;

// Helper: chainable Supabase mock
function createQueryMock(result: { data?: any; error?: any } = { data: null, error: null }) {
  const mock: any = {};
  const methods = [
    "select", "insert", "update", "delete", "eq", "neq", "in", "not",
    "or", "ilike", "order", "gte", "lte", "single", "upsert", "limit", "is",
  ];
  methods.forEach((m) => {
    mock[m] = jest.fn().mockReturnValue(mock);
  });
  mock.then = (resolve: (value: unknown) => void) => resolve(result);
  return mock;
}

function setupAuth(overrides: Partial<{ role: string; userId: string }> = {}) {
  const queryMock = createQueryMock();
  const rpcMock = jest.fn().mockResolvedValue({ data: null, error: null });
  const supabase = {
    from: jest.fn().mockReturnValue(queryMock),
    rpc: rpcMock,
    auth: { getUser: jest.fn() },
  };
  requireAuthMock.mockResolvedValue({
    supabase: supabase as any,
    user: { id: overrides.userId || "user-1" } as any,
    role: (overrides.role || "admin") as any,
    linkedMemberId: 1,
  });
  return { supabase, queryMock, rpcMock };
}

// ========== deleteUser ==========

describe("deleteUser", () => {
  beforeEach(() => jest.clearAllMocks());

  it("admin이 다른 사용자를 삭제한다", async () => {
    const { rpcMock } = setupAuth({ role: "admin" });

    const result = await deleteUser("target-user-id");

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("admin_delete_user", {
      target_user_id: "target-user-id",
    });
  });

  it("non-admin은 권한 에러 반환", async () => {
    setupAuth({ role: "group_leader" });

    const result = await deleteUser("target-user-id");

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("자기 자신 삭제 시도 시 에러 반환", async () => {
    setupAuth({ role: "admin", userId: "user-1" });

    const result = await deleteUser("user-1");

    expect(result).toEqual({ success: false, error: "자신의 계정은 삭제할 수 없습니다." });
  });

  it("RPC 에러 시 실패 응답 반환", async () => {
    const { rpcMock } = setupAuth({ role: "admin" });
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc error" } });

    const result = await deleteUser("target-user-id");

    expect(result).toEqual({ success: false, error: "사용자 삭제에 실패했습니다." });
  });
});

// ========== updateUserName ==========

describe("updateUserName", () => {
  beforeEach(() => jest.clearAllMocks());

  it("admin이 사용자 이름을 변경한다", async () => {
    const { rpcMock } = setupAuth({ role: "admin" });

    const result = await updateUserName("target-user-id", "새이름");

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("admin_update_user_name", {
      target_user_id: "target-user-id",
      new_name: "새이름",
    });
  });

  it("non-admin은 권한 에러 반환", async () => {
    setupAuth({ role: "group_leader" });

    const result = await updateUserName("target-user-id", "새이름");

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("빈 이름은 에러 반환", async () => {
    setupAuth({ role: "admin" });

    const result = await updateUserName("target-user-id", "  ");

    expect(result).toEqual({ success: false, error: "이름을 입력해주세요." });
  });

  it("RPC 에러 시 실패 응답 반환", async () => {
    const { rpcMock } = setupAuth({ role: "admin" });
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc error" } });

    const result = await updateUserName("target-user-id", "새이름");

    expect(result).toEqual({ success: false, error: "이름 변경에 실패했습니다." });
  });
});

// ========== getUsers ==========

describe("getUsers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("admin이 사용자 목록을 조회한다", async () => {
    const { queryMock } = setupAuth({ role: "admin" });
    const mockUsers = [
      { id: "u1", email: "a@test.com", name: "김철수", role: "admin", created_at: "2025-01-01", linked_member_id: null },
    ];
    queryMock.then = (resolve: (value: unknown) => void) => resolve({ data: mockUsers, error: null });

    const result = await getUsers();

    expect(result).toEqual(mockUsers);
  });

  it("non-admin은 빈 배열 반환", async () => {
    setupAuth({ role: "group_leader" });

    const result = await getUsers();

    expect(result).toEqual([]);
  });
});

// ========== updateUserRole ==========

describe("updateUserRole", () => {
  beforeEach(() => jest.clearAllMocks());

  it("admin이 역할을 변경한다", async () => {
    const { rpcMock } = setupAuth({ role: "admin" });

    const result = await updateUserRole("target-user-id", "group_leader");

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("update_user_role", {
      target_user_id: "target-user-id",
      new_role: "group_leader",
    });
  });

  it("자기 자신 역할 변경 시 에러 반환", async () => {
    setupAuth({ role: "admin", userId: "user-1" });

    const result = await updateUserRole("user-1", "group_leader");

    expect(result).toEqual({ success: false, error: "자신의 역할은 변경할 수 없습니다." });
  });

  it("유효하지 않은 역할은 에러 반환", async () => {
    setupAuth({ role: "admin" });

    const result = await updateUserRole("target-user-id", "invalid_role" as any);

    expect(result).toEqual({ success: false, error: "유효하지 않은 역할입니다." });
  });
});

// ========== linkMemberToUser ==========

describe("linkMemberToUser", () => {
  beforeEach(() => jest.clearAllMocks());

  it("admin이 멤버를 연결한다", async () => {
    const { rpcMock } = setupAuth({ role: "admin" });

    const result = await linkMemberToUser("target-user-id", 42);

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("link_member_to_user", {
      target_user_id: "target-user-id",
      member_id_to_link: 42,
    });
  });

  it("non-admin은 권한 에러 반환", async () => {
    setupAuth({ role: "group_leader" });

    const result = await linkMemberToUser("target-user-id", 42);

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });
});
