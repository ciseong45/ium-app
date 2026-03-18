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

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.append(key, value);
  }
  return fd;
}

// 동적 import로 server action 모듈 로드
async function importActions() {
  return await import("../actions");
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ===== createSeason =====
describe("createSeason", () => {
  it("admin만 시즌 생성 가능", async () => {
    setupAuth("group_leader");
    const { createSeason } = await importActions();
    const fd = makeFormData({ name: "2024 상반기" });

    const result = await createSeason(fd);

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("이름이 없으면 에러", async () => {
    setupAuth("admin");
    const { createSeason } = await importActions();
    const fd = makeFormData({ name: "" });

    const result = await createSeason(fd);

    expect(result).toEqual({ success: false, error: "시즌 이름은 필수입니다." });
  });

  it("생성 성공 시 다락방 3개 자동 생성", async () => {
    const { supabase } = setupAuth("admin");

    // 첫 번째 from("small_group_seasons") 호출: insert -> select -> single
    const seasonInsertMock = createQueryMock({
      data: { id: 99 },
      error: null,
    });
    // 두 번째 from("upper_rooms") 호출: insert
    const upperRoomInsertMock = createQueryMock({ data: null, error: null });

    supabase.from
      .mockReturnValueOnce(seasonInsertMock)
      .mockReturnValueOnce(upperRoomInsertMock);

    const { createSeason } = await importActions();
    const fd = makeFormData({ name: "2024 상반기" });

    const result = await createSeason(fd);

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("upper_rooms");
    expect(upperRoomInsertMock.insert).toHaveBeenCalledWith([
      { season_id: 99, name: "1다락방", display_order: 1 },
      { season_id: 99, name: "2다락방", display_order: 2 },
      { season_id: 99, name: "3다락방", display_order: 3 },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/small-groups");
  });
});

// ===== updateSeason =====
describe("updateSeason", () => {
  it("admin만 수정 가능", async () => {
    setupAuth("group_leader");
    const { updateSeason } = await importActions();
    const fd = makeFormData({ name: "수정된 시즌" });

    const result = await updateSeason(1, fd);

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("이름이 없으면 에러", async () => {
    setupAuth("admin");
    const { updateSeason } = await importActions();
    const fd = makeFormData({ name: "  " });

    const result = await updateSeason(1, fd);

    expect(result).toEqual({ success: false, error: "시즌 이름은 필수입니다." });
  });
});

// ===== deleteSeason =====
describe("deleteSeason", () => {
  it("admin만 삭제 가능", async () => {
    setupAuth("admin");
    const { deleteSeason } = await importActions();

    const result = await deleteSeason(1);

    expect(result).toEqual({ success: true });
  });

  it("non-admin은 권한 에러", async () => {
    setupAuth("upper_room_leader");
    const { deleteSeason } = await importActions();

    const result = await deleteSeason(1);

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });
});

// ===== createGroup =====
describe("createGroup", () => {
  it("admin만 그룹 생성 가능", async () => {
    setupAuth("group_leader");
    const { createGroup } = await importActions();
    const fd = makeFormData({ name: "1순" });

    const result = await createGroup(1, 10, fd);

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("이름이 없으면 에러", async () => {
    setupAuth("admin");
    const { createGroup } = await importActions();
    const fd = makeFormData({ name: "" });

    const result = await createGroup(1, 10, fd);

    expect(result).toEqual({ success: false, error: "그룹 이름은 필수입니다." });
  });
});

// ===== deleteGroup =====
describe("deleteGroup", () => {
  it("admin만 삭제 가능", async () => {
    setupAuth("group_leader");
    const { deleteGroup } = await importActions();

    const result = await deleteGroup(1, 1);

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });
});

// ===== assignMember =====
describe("assignMember", () => {
  it("group_leader는 권한 없음", async () => {
    setupAuth("group_leader");
    const { assignMember } = await importActions();

    const result = await assignMember(1, 100, 1);

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("정상 배정 성공", async () => {
    const { supabase, queryMock } = setupAuth("admin");
    const { assignMember } = await importActions();

    const result = await assignMember(1, 100, 1);

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("small_group_members");
    expect(queryMock.insert).toHaveBeenCalledWith({
      group_id: 1,
      member_id: 100,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/small-groups/1");
  });
});

// ===== unassignMember =====
describe("unassignMember", () => {
  it("group_leader는 권한 없음", async () => {
    setupAuth("group_leader");
    const { unassignMember } = await importActions();

    const result = await unassignMember(1, 100, 1);

    expect(result).toEqual({ success: false, error: "권한이 없습니다." });
  });

  it("정상 제외 성공", async () => {
    const { supabase, queryMock } = setupAuth("admin");
    const { unassignMember } = await importActions();

    const result = await unassignMember(1, 100, 1);

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("small_group_members");
    expect(queryMock.delete).toHaveBeenCalled();
    expect(queryMock.eq).toHaveBeenCalledWith("group_id", 1);
    expect(queryMock.eq).toHaveBeenCalledWith("member_id", 100);
    expect(revalidatePath).toHaveBeenCalledWith("/small-groups/1");
  });
});

// ===== getSeasons =====
describe("getSeasons", () => {
  it("에러 시 빈 배열 반환", async () => {
    const queryMock = createQueryMock({
      data: null,
      error: { message: "DB error" },
    });
    const supabase = { from: jest.fn().mockReturnValue(queryMock) };
    requireAuthMock.mockResolvedValue({
      supabase: supabase as any,
      user: { id: "user-1" } as any,
      role: "admin" as any,
      linkedMemberId: 1,
    });

    const { getSeasons } = await importActions();
    const result = await getSeasons();

    expect(result).toEqual([]);
  });
});
