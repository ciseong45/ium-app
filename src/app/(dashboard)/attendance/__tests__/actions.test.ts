/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from "@/lib/auth";
import { getActiveSeason } from "@/lib/queries";
import { revalidatePath } from "next/cache";
import {
  getMyGroups,
  getGroupMembersForAttendance,
  getGroupAttendance,
  saveGroupAttendance,
} from "../actions";

jest.mock("@/lib/auth");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/queries");

const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;
const getActiveSeasonMock = getActiveSeason as jest.MockedFunction<typeof getActiveSeason>;

function createQueryMock(result: { data?: any; error?: any } = { data: null, error: null }) {
  const mock: any = {};
  ["select", "insert", "update", "delete", "eq", "neq", "in", "not", "or", "ilike", "order", "gte", "lte", "single", "upsert", "limit", "is"].forEach(
    (m) => {
      mock[m] = jest.fn().mockReturnValue(mock);
    }
  );
  mock.then = (resolve: (value: unknown) => void) => resolve(result);
  return mock;
}

function mockSupabase(fromMap: Record<string, ReturnType<typeof createQueryMock>>) {
  return {
    from: jest.fn((table: string) => fromMap[table] ?? createQueryMock()),
  } as any;
}

// ===== getMyGroups =====

describe("getMyGroups", () => {
  it("활성 시즌이 없으면 빈 배열 반환", async () => {
    const supabase = mockSupabase({});
    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" } as any,
      role: "admin",
      linkedMemberId: null,
    });
    getActiveSeasonMock.mockResolvedValue(null);

    const result = await getMyGroups();
    expect(result).toEqual([]);
  });

  it("admin은 모든 그룹 조회", async () => {
    const groupsData = [
      {
        id: 1,
        name: "순1",
        upper_room: { name: "다락방A" },
        leader: { last_name: "김", first_name: "철수" },
      },
      {
        id: 2,
        name: "순2",
        upper_room: { name: "다락방B" },
        leader: null,
      },
    ];
    const queryMock = createQueryMock({ data: groupsData });
    const supabase = mockSupabase({ small_groups: queryMock });

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" } as any,
      role: "admin",
      linkedMemberId: null,
    });
    getActiveSeasonMock.mockResolvedValue({ id: 1, name: "2026 봄", is_active: true });

    const result = await getMyGroups();

    expect(supabase.from).toHaveBeenCalledWith("small_groups");
    expect(queryMock.eq).toHaveBeenCalledWith("season_id", 1);
    expect(queryMock.order).toHaveBeenCalledWith("name");
    expect(result).toEqual([
      { id: 1, name: "순1", upper_room_name: "다락방A", leader_name: "김철수" },
      { id: 2, name: "순2", upper_room_name: "다락방B", leader_name: null },
    ]);
  });

  it("group_leader는 자기 순만 조회", async () => {
    const groupsData = [
      {
        id: 3,
        name: "순3",
        upper_room: { name: "다락방C" },
        leader: { last_name: "이", first_name: "영희" },
      },
    ];
    const queryMock = createQueryMock({ data: groupsData });
    const supabase = mockSupabase({ small_groups: queryMock });

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-2" } as any,
      role: "group_leader",
      linkedMemberId: 10,
    });
    getActiveSeasonMock.mockResolvedValue({ id: 1, name: "2026 봄", is_active: true });

    const result = await getMyGroups();

    expect(queryMock.eq).toHaveBeenCalledWith("leader_id", 10);
    expect(queryMock.eq).toHaveBeenCalledWith("season_id", 1);
    expect(result).toEqual([
      { id: 3, name: "순3", upper_room_name: "다락방C", leader_name: "이영희" },
    ]);
  });
});

// ===== getGroupMembersForAttendance =====

describe("getGroupMembersForAttendance", () => {
  it("그룹 멤버 목록 조회 성공", async () => {
    const membersData = [
      { member: { id: 1, last_name: "김", first_name: "철수" } },
      { member: { id: 2, last_name: "이", first_name: "영희" } },
    ];
    const queryMock = createQueryMock({ data: membersData });
    const supabase = mockSupabase({ small_group_members: queryMock });

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" } as any,
      role: "admin",
      linkedMemberId: null,
    });

    const result = await getGroupMembersForAttendance(1);

    expect(supabase.from).toHaveBeenCalledWith("small_group_members");
    expect(queryMock.eq).toHaveBeenCalledWith("group_id", 1);
    expect(queryMock.order).toHaveBeenCalledWith("created_at");
    expect(result).toEqual([
      { id: 1, name: "김철수" },
      { id: 2, name: "이영희" },
    ]);
  });

  it("에러 시 빈 배열 반환", async () => {
    const queryMock = createQueryMock({ data: null, error: { message: "DB error" } });
    const supabase = mockSupabase({ small_group_members: queryMock });

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" } as any,
      role: "admin",
      linkedMemberId: null,
    });

    const result = await getGroupMembersForAttendance(1);
    expect(result).toEqual([]);
  });
});

// ===== getGroupAttendance =====

describe("getGroupAttendance", () => {
  it("출석 데이터 조회 성공", async () => {
    const sgMembersData = [{ member_id: 1 }, { member_id: 2 }];
    const attendanceData = [
      { id: 10, member_id: 1, week_date: "2026-03-15", status: "present", prayer_request: false, prayer_note: null },
      { id: 11, member_id: 2, week_date: "2026-03-15", status: "absent", prayer_request: true, prayer_note: "기도해주세요" },
    ];

    const sgQuery = createQueryMock({ data: sgMembersData });
    const attQuery = createQueryMock({ data: attendanceData });

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "small_group_members") return sgQuery;
        if (table === "attendance") return attQuery;
        return createQueryMock();
      }),
    } as any;

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" } as any,
      role: "admin",
      linkedMemberId: null,
    });

    const result = await getGroupAttendance(1, "2026-03-15");

    expect(supabase.from).toHaveBeenCalledWith("small_group_members");
    expect(supabase.from).toHaveBeenCalledWith("attendance");
    expect(attQuery.in).toHaveBeenCalledWith("member_id", [1, 2]);
    expect(attQuery.eq).toHaveBeenCalledWith("week_date", "2026-03-15");
    expect(result).toEqual(attendanceData);
  });

  it("멤버가 없으면 빈 배열", async () => {
    const sgQuery = createQueryMock({ data: [] });
    const supabase = mockSupabase({ small_group_members: sgQuery });

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" } as any,
      role: "admin",
      linkedMemberId: null,
    });

    const result = await getGroupAttendance(1, "2026-03-15");
    expect(result).toEqual([]);
  });
});

// ===== saveGroupAttendance =====

describe("saveGroupAttendance", () => {
  const sampleRecords = [
    { member_id: 1, status: "present" as const, prayer_request: false, prayer_note: null },
    { member_id: 2, status: "absent" as const, prayer_request: true, prayer_note: "기도 부탁" },
  ];

  it("admin은 모든 순 출석 저장 가능", async () => {
    const attQuery = createQueryMock({ data: null, error: null });
    const supabase = mockSupabase({ attendance: attQuery });

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-admin" } as any,
      role: "admin",
      linkedMemberId: null,
    });

    const result = await saveGroupAttendance(1, "2026-03-15", sampleRecords);

    expect(result).toEqual({ success: true });
    expect(attQuery.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ member_id: 1, status: "present", checked_by: "user-admin" }),
        expect.objectContaining({ member_id: 2, status: "absent", checked_by: "user-admin" }),
      ]),
      { onConflict: "member_id,week_date" }
    );
    expect(revalidatePath).toHaveBeenCalledWith("/attendance");
  });

  it("group_leader는 자기 순만 저장 가능", async () => {
    const groupQuery = createQueryMock({ data: { leader_id: 10 } });
    const attQuery = createQueryMock({ data: null, error: null });

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "small_groups") return groupQuery;
        if (table === "attendance") return attQuery;
        return createQueryMock();
      }),
    } as any;

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-leader" } as any,
      role: "group_leader",
      linkedMemberId: 10,
    });
    getActiveSeasonMock.mockResolvedValue({ id: 1, name: "2026 봄", is_active: true });

    const result = await saveGroupAttendance(5, "2026-03-15", sampleRecords);

    expect(groupQuery.eq).toHaveBeenCalledWith("id", 5);
    expect(result).toEqual({ success: true });
  });

  it("group_leader가 다른 순에 저장 시 에러", async () => {
    const groupQuery = createQueryMock({ data: { leader_id: 99 } });
    const supabase = mockSupabase({ small_groups: groupQuery });

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-leader" } as any,
      role: "group_leader",
      linkedMemberId: 10,
    });
    getActiveSeasonMock.mockResolvedValue({ id: 1, name: "2026 봄", is_active: true });

    const result = await saveGroupAttendance(5, "2026-03-15", sampleRecords);

    expect(result).toEqual({
      success: false,
      error: "자신의 순만 출석을 기록할 수 있습니다.",
    });
  });

  it("빈 records면 에러", async () => {
    const supabase = mockSupabase({});

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-admin" } as any,
      role: "admin",
      linkedMemberId: null,
    });

    const result = await saveGroupAttendance(1, "2026-03-15", []);

    expect(result).toEqual({
      success: false,
      error: "저장할 출석 데이터가 없습니다.",
    });
  });

  it("DB 에러 시 일반 메시지", async () => {
    const attQuery = createQueryMock({ data: null, error: { message: "constraint violation" } });
    const supabase = mockSupabase({ attendance: attQuery });

    requireAuthMock.mockResolvedValue({
      supabase,
      user: { id: "user-admin" } as any,
      role: "admin",
      linkedMemberId: null,
    });

    const result = await saveGroupAttendance(1, "2026-03-15", sampleRecords);

    expect(result).toEqual({
      success: false,
      error: "출석 저장에 실패했습니다.",
    });
  });
});
