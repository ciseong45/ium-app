import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Supabase server client mock
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function createMockSupabase({
  user = null,
  authError = null,
  profile = null,
}: {
  user?: { id: string } | null;
  authError?: Error | null;
  profile?: { role: string; linked_member_id: number | null } | null;
} = {}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: profile }),
        }),
      }),
    }),
  };
}

describe("requireAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("미인증 시 '인증이 필요합니다.' 에러 발생", async () => {
    const mockSupabase = createMockSupabase({
      user: null,
      authError: new Error("no user"),
    });
    mockedCreateClient.mockResolvedValue(mockSupabase as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    await expect(requireAuth()).rejects.toThrow("인증이 필요합니다.");
  });

  it("user 없이 error만 있어도 에러 발생", async () => {
    const mockSupabase = createMockSupabase({ user: null, authError: null });
    mockedCreateClient.mockResolvedValue(mockSupabase as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    await expect(requireAuth()).rejects.toThrow("인증이 필요합니다.");
  });

  it("프로필 존재 시 해당 role 반환", async () => {
    const mockSupabase = createMockSupabase({
      user: { id: "user-1" },
      profile: { role: "admin", linked_member_id: 10 },
    });
    mockedCreateClient.mockResolvedValue(mockSupabase as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    const result = await requireAuth();
    expect(result.role).toBe("admin");
    expect(result.linkedMemberId).toBe(10);
    expect(result.user).toEqual({ id: "user-1" });
  });

  it("프로필 없으면 에러 발생", async () => {
    const mockSupabase = createMockSupabase({
      user: { id: "user-2" },
      profile: null,
    });
    mockedCreateClient.mockResolvedValue(mockSupabase as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    await expect(requireAuth()).rejects.toThrow("프로필을 찾을 수 없습니다.");
  });

  it("linked_member_id가 없으면 null 반환", async () => {
    const mockSupabase = createMockSupabase({
      user: { id: "user-3" },
      profile: { role: "upper_room_leader", linked_member_id: null },
    });
    mockedCreateClient.mockResolvedValue(mockSupabase as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    const result = await requireAuth();
    expect(result.role).toBe("upper_room_leader");
    expect(result.linkedMemberId).toBeNull();
  });
});
