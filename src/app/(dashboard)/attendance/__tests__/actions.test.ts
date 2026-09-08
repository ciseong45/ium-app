/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from "@/lib/auth";
import { getActiveSeason } from "@/lib/queries";
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

// ===== saveGroupAttendance atomic RPC =====
describe("saveGroupAttendance", () => {
  const record = { member_id: 1, status: "present" as const, prayer_request: false, prayer_note: null };
  const setup = (error: unknown = null) => {
    const rpc = jest.fn().mockResolvedValue({ error });
    requireAuthMock.mockResolvedValue({ supabase: { rpc } as any, user: { id: "admin" } as any, role: "admin", linkedMemberId: null });
    return rpc;
  };
  it("검증된 일괄 출석을 하나의 트랜잭션으로 저장한다", async () => {
    const rpc = setup();
    expect(await saveGroupAttendance(1, "2026-09-06", [record])).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("save_group_attendance", { p_group_id: 1, p_week_date: "2026-09-06", p_records: [record] });
  });
  it("체크 해제를 명시적으로 서버에 전달한다", async () => {
    const rpc = setup();
    expect(await saveGroupAttendance(1, "2026-09-06", [{ ...record, status: null }])).toEqual({ success: true });
    expect(rpc).toHaveBeenCalled();
  });
  it("잘못된 날짜와 중복 대상자는 저장하지 않는다", async () => {
    const rpc = setup();
    expect((await saveGroupAttendance(1, "2026-02-30", [record])).success).toBe(false);
    expect((await saveGroupAttendance(1, "2026-09-06", [record, record])).success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("저장 실패를 성공으로 보고하지 않는다", async () => {
    setup({ message: "ATTENDANCE_DENIED" });
    expect((await saveGroupAttendance(1, "2026-09-06", [record])).success).toBe(false);
  });
});
