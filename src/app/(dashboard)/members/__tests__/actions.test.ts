import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { insertStatusLog, ensureNewFamilyEntry } from "@/lib/queries";

jest.mock("@/lib/auth");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/queries", () => ({
  insertStatusLog: jest.fn(),
  ensureNewFamilyEntry: jest.fn(),
  expireAdjustingMembers: jest.fn().mockResolvedValue([]),
  getActiveSeason: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/lib/csv", () => ({
  escapeCsvField: jest.fn((v: string) => v),
  parseCsvLine: jest.fn((line: string) => line.split(",")),
}));

import {
  createMember,
  updateMember,
  deleteMember,
  deleteMembers,
  quickUpdateField,
  exportMembersCSV,
  importMembersCSV,
} from "../actions";

const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;
const insertStatusLogMock = insertStatusLog as jest.MockedFunction<typeof insertStatusLog>;

// Helper: chainable Supabase mock that resolves to { data, error }
function createQueryMock(result: { data?: any; error?: any } = { data: null, error: null }) {
  const mock: any = {};
  const methods = [
    "select", "insert", "update", "delete", "eq", "neq", "in", "not",
    "or", "ilike", "order", "gte", "lte", "single", "upsert", "limit", "is",
  ];
  methods.forEach((m) => {
    mock[m] = jest.fn().mockReturnValue(mock);
  });
  // When awaited, resolve to result
  mock.then = (resolve: Function) => resolve(result);
  return mock;
}

function setupAuth(overrides: Partial<{ role: string; linkedMemberId: number | null }> = {}) {
  const queryMock = createQueryMock();
  const supabase = {
    from: jest.fn().mockReturnValue(queryMock),
    auth: { getUser: jest.fn() },
  };
  requireAuthMock.mockResolvedValue({
    supabase: supabase as any,
    user: { id: "user-1" } as any,
    role: (overrides.role || "admin") as any,
    linkedMemberId: overrides.linkedMemberId ?? 1,
  });
  return { supabase, queryMock };
}

function buildMemberFormData(overrides: Record<string, string> = {}): FormData {
  const defaults: Record<string, string> = {
    last_name: "홍",
    first_name: "길동",
    phone: "010-1234-5678",
    email: "test@example.com",
    gender: "M",
    birth_date: "1995-01-01",
    address: "서울시",
    status: "active",
    kakao_id: "hong",
    is_baptized: "true",
    school_or_work: "한국대학교",
    notes: "메모",
  };
  const merged = { ...defaults, ...overrides };
  const fd = new FormData();
  Object.entries(merged).forEach(([k, v]) => fd.set(k, v));
  return fd;
}

// ========== Tests ==========

describe("createMember", () => {
  beforeEach(() => jest.clearAllMocks());

  it("admin 역할일 때 멤버를 생성한다", async () => {
    const { supabase, queryMock } = setupAuth({ role: "admin" });
    queryMock.then = (resolve: Function) => resolve({ data: null, error: null });

    const result = await createMember(buildMemberFormData());

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("members");
    expect(queryMock.insert).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/members");
  });

  it("group_leader 역할일 때 권한 에러 반환", async () => {
    setupAuth({ role: "group_leader" });

    const result = await createMember(buildMemberFormData());

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("유효성 검사 실패 시 에러 반환", async () => {
    setupAuth({ role: "admin" });

    const fd = buildMemberFormData({ last_name: "" });
    const result = await createMember(fd);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it("DB 에러 시 일반 에러 메시지 반환", async () => {
    const { queryMock } = setupAuth({ role: "admin" });
    queryMock.then = (resolve: Function) =>
      resolve({ data: null, error: { message: "db error" } });

    const result = await createMember(buildMemberFormData());

    expect(result).toEqual({ success: false, error: "멤버 등록에 실패했습니다." });
  });
});

describe("updateMember", () => {
  beforeEach(() => jest.clearAllMocks());

  it("멤버 정보를 수정한다", async () => {
    const { supabase } = setupAuth({ role: "admin" });

    // First call: from("members").select("status").eq().single() -> current member
    // Second call: from("members").update().eq() -> update result
    const selectMock = createQueryMock({ data: { status: "active" }, error: null });
    const updateMock = createQueryMock({ data: null, error: null });

    let callCount = 0;
    supabase.from.mockImplementation(() => {
      callCount++;
      // First from("members") call is for select("status"), second is for update
      if (callCount === 1) return selectMock;
      return updateMock;
    });

    const result = await updateMember(1, buildMemberFormData({ status: "active" }));

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith("/members");
  });

  it("group_leader는 권한 없음", async () => {
    setupAuth({ role: "group_leader" });

    const result = await updateMember(1, buildMemberFormData());

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("상태 변경 시 이력 기록", async () => {
    const { supabase } = setupAuth({ role: "admin" });

    const selectMock = createQueryMock({ data: { status: "active" }, error: null });
    const updateMock = createQueryMock({ data: null, error: null });

    let callCount = 0;
    supabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectMock;
      return updateMock;
    });

    const result = await updateMember(1, buildMemberFormData({ status: "attending" }));

    expect(result).toEqual({ success: true });
    expect(insertStatusLogMock).toHaveBeenCalledWith(
      expect.anything(),
      1,
      "active",
      "attending",
      "user-1"
    );
  });
});

describe("deleteMember", () => {
  beforeEach(() => jest.clearAllMocks());

  it("admin만 삭제 가능", async () => {
    const { queryMock } = setupAuth({ role: "admin" });
    queryMock.then = (resolve: Function) => resolve({ data: null, error: null });

    const result = await deleteMember(1);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith("/members");
  });

  it("admin이 아니면 권한 에러", async () => {
    setupAuth({ role: "upper_room_leader" });

    const result = await deleteMember(1);

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("DB 에러 시 일반 메시지", async () => {
    const { queryMock } = setupAuth({ role: "admin" });
    queryMock.then = (resolve: Function) =>
      resolve({ data: null, error: { message: "fk constraint" } });

    const result = await deleteMember(1);

    expect(result).toEqual({ success: false, error: "멤버 삭제에 실패했습니다." });
  });
});

describe("deleteMembers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("빈 배열이면 에러", async () => {
    setupAuth({ role: "admin" });

    const result = await deleteMembers([]);

    expect(result).toEqual({ success: false, error: "삭제할 멤버가 없습니다." });
  });

  it("admin만 삭제 가능", async () => {
    const { queryMock } = setupAuth({ role: "admin" });
    queryMock.then = (resolve: Function) => resolve({ data: null, error: null });

    const result = await deleteMembers([1, 2, 3]);

    expect(result).toEqual({ success: true });
  });

  it("admin이 아니면 권한 에러", async () => {
    setupAuth({ role: "group_leader" });

    const result = await deleteMembers([1, 2]);

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });
});

describe("quickUpdateField", () => {
  beforeEach(() => jest.clearAllMocks());

  it("유효하지 않은 성별 값 거부", async () => {
    setupAuth({ role: "admin" });

    const result = await quickUpdateField(1, "gender", "X");

    expect(result).toEqual({ success: false, error: "잘못된 성별 값입니다." });
  });

  it("유효하지 않은 상태 값 거부", async () => {
    setupAuth({ role: "admin" });

    const result = await quickUpdateField(1, "status", "invalid_status");

    expect(result).toEqual({ success: false, error: "잘못된 상태 값입니다." });
  });

  it("정상적인 필드 업데이트", async () => {
    const { supabase } = setupAuth({ role: "admin" });

    // For gender field, no status log needed — just straight update
    const updateMock = createQueryMock({ data: null, error: null });
    supabase.from.mockReturnValue(updateMock);

    const result = await quickUpdateField(1, "gender", "F");

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("members");
  });

  it("group_leader는 권한 없음", async () => {
    setupAuth({ role: "group_leader" });

    const result = await quickUpdateField(1, "gender", "M");

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });
});

describe("exportMembersCSV", () => {
  beforeEach(() => jest.clearAllMocks());

  it("CSV 형식으로 멤버 데이터 내보내기", async () => {
    const { queryMock } = setupAuth({ role: "admin" });
    queryMock.then = (resolve: Function) =>
      resolve({
        data: [
          {
            last_name: "홍",
            first_name: "길동",
            phone: "010-1234-5678",
            email: "hong@test.com",
            gender: "M",
            birth_date: "1995-01-01",
            address: "서울시",
            status: "active",
            kakao_id: "hong",
            is_baptized: true,
            school_or_work: "한국대학교",
            notes: "",
          },
        ],
        error: null,
      });

    const result = await exportMembersCSV();

    expect(result.success).toBe(true);
    if (result.success) {
      // BOM check
      expect(result.csv.startsWith("\uFEFF")).toBe(true);
      // Header check
      expect(result.csv).toContain("성,이름,전화번호,이메일,성별,생년월일,주소,상태");
    }
  });
});

describe("importMembersCSV", () => {
  beforeEach(() => jest.clearAllMocks());

  it("group_leader는 권한 없음", async () => {
    setupAuth({ role: "group_leader" });

    const result = await importMembersCSV("성,이름\n홍,길동");

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("빈 CSV 데이터", async () => {
    setupAuth({ role: "admin" });

    const result = await importMembersCSV("성,이름");

    expect(result).toEqual({ success: false, error: "CSV 파일에 데이터가 없습니다." });
  });

  it("필수 헤더 없으면 에러", async () => {
    setupAuth({ role: "admin" });

    const result = await importMembersCSV("전화번호,이메일\n010,test@test.com");

    expect(result).toEqual({ success: false, error: "CSV에 '성'과 '이름' 열이 필요합니다." });
  });

  it("정상적인 CSV 가져오기", async () => {
    const { queryMock } = setupAuth({ role: "admin" });
    queryMock.then = (resolve: Function) => resolve({ data: null, error: null });

    const csv = "성,이름,전화번호\n홍,길동,010-1234-5678\n김,철수,010-9876-5432";
    const result = await importMembersCSV(csv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.imported).toBe(2);
    }
  });
});
