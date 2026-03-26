import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getActiveSeason,
  fetchActiveMembers,
  insertStatusLog,
  ensureNewFamilyEntry,
  expireAdjustingMembers,
  markDroppedOutNewFamilies,
} from "@/lib/queries";

// ===== Mock Supabase 헬퍼 =====

type MockClient = SupabaseClient & { from: jest.Mock };

function buildMockClient(fromImpl: jest.Mock): MockClient {
  return { from: fromImpl } as unknown as MockClient;
}

// ===== getActiveSeason =====

describe("getActiveSeason", () => {
  it("활성 시즌 반환", async () => {
    const seasonData = { id: 1, name: "2026 봄학기", is_active: true };
    const fromMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: seasonData }),
        }),
      }),
    });
    const client = buildMockClient(fromMock);

    const result = await getActiveSeason(client);
    expect(result).toEqual(seasonData);
  });

  it("활성 시즌 없으면 null 반환", async () => {
    const fromMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    const client = buildMockClient(fromMock);

    const result = await getActiveSeason(client);
    expect(result).toBeNull();
  });
});

// ===== fetchActiveMembers =====

describe("fetchActiveMembers", () => {
  it("기본 필터로 멤버 목록 반환", async () => {
    const members = [
      { id: 1, last_name: "김", first_name: "철수" },
      { id: 2, last_name: "박", first_name: "지영" },
    ];
    const fromMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        in: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: members, error: null }),
          }),
        }),
      }),
    });
    const client = buildMockClient(fromMock);

    const result = await fetchActiveMembers(client);
    expect(result).toEqual(members);
  });

  it("에러 시 빈 배열 반환", async () => {
    const fromMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        in: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: new Error("DB error"),
            }),
          }),
        }),
      }),
    });
    const client = buildMockClient(fromMock);

    const result = await fetchActiveMembers(client);
    expect(result).toEqual([]);
  });
});

// ===== insertStatusLog =====

describe("insertStatusLog", () => {
  it("상태 변경 이력을 insert", async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });
    const fromMock = jest.fn().mockReturnValue({ insert: insertMock });
    const client = buildMockClient(fromMock);

    await insertStatusLog(client, 42, "active", "removed", "user-1");

    expect(fromMock).toHaveBeenCalledWith("member_status_log");
    expect(insertMock).toHaveBeenCalledWith({
      member_id: 42,
      old_status: "active",
      new_status: "removed",
      changed_by: "user-1",
    });
  });
});

// ===== ensureNewFamilyEntry =====

describe("ensureNewFamilyEntry", () => {
  it("이미 존재하면 아무것도 하지 않음", async () => {
    const insertMock = jest.fn();
    const fromMock = jest.fn().mockImplementation((table: string) => {
      if (table === "new_family") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 1 } }),
            }),
          }),
          insert: insertMock,
        };
      }
      return {};
    });
    const client = buildMockClient(fromMock);

    await ensureNewFamilyEntry(client, 10);

    // insert가 호출되지 않아야 함 (이미 존재하므로)
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("존재하지 않으면 새 엔트리 생성", async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });
    const selectSingle = jest.fn().mockResolvedValue({ data: null });
    const seasonSingle = jest
      .fn()
      .mockResolvedValue({ data: { id: 5, name: "봄학기", is_active: true } });

    const fromMock = jest.fn().mockImplementation((table: string) => {
      if (table === "new_family") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ single: selectSingle }),
          }),
          insert: insertMock,
        };
      }
      if (table === "small_group_seasons") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ single: seasonSingle }),
          }),
        };
      }
      return {};
    });
    const client = buildMockClient(fromMock);

    await ensureNewFamilyEntry(client, 10);

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: 10,
        season_id: 5,
      })
    );
  });
});

// ===== expireAdjustingMembers =====

describe("expireAdjustingMembers", () => {
  it("빈 배열 입력 시 즉시 빈 배열 반환", async () => {
    const fromMock = jest.fn();
    const client = buildMockClient(fromMock);

    const result = await expireAdjustingMembers(client, []);
    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("3개월 이상 경과한 step 3 멤버를 만료 처리", async () => {
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

    const updateMock = jest.fn().mockReturnValue({
      in: jest.fn().mockResolvedValue({ error: null }),
    });
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    const fromMock = jest.fn().mockImplementation((table: string) => {
      if (table === "new_family") {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  {
                    member_id: 1,
                    step_updated_at: fourMonthsAgo.toISOString(),
                  },
                ],
              }),
            }),
          }),
        };
      }
      if (table === "members") {
        return { update: updateMock };
      }
      if (table === "member_status_log") {
        return { insert: insertMock };
      }
      return {};
    });
    const client = buildMockClient(fromMock);

    const result = await expireAdjustingMembers(client, [1, 2]);
    expect(result).toEqual([1]);
    expect(updateMock).toHaveBeenCalledWith({ status: "attending" });
    expect(insertMock).toHaveBeenCalledWith([
      {
        member_id: 1,
        old_status: "adjusting",
        new_status: "attending",
        changed_by: null,
      },
    ]);
  });

  it("3개월 미경과 멤버는 만료하지 않음", async () => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const fromMock = jest.fn().mockImplementation((table: string) => {
      if (table === "new_family") {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  {
                    member_id: 1,
                    step_updated_at: oneMonthAgo.toISOString(),
                  },
                ],
              }),
            }),
          }),
        };
      }
      return {};
    });
    const client = buildMockClient(fromMock);

    const result = await expireAdjustingMembers(client, [1]);
    expect(result).toEqual([]);
  });
});

// ===== markDroppedOutNewFamilies =====

describe("markDroppedOutNewFamilies", () => {
  it("4주 이상 정체된 새가족을 이탈 처리", async () => {
    const fiveWeeksAgo = new Date();
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);

    const updateInMock = jest.fn().mockResolvedValue({ error: null });
    const updateMock = jest.fn().mockReturnValue({ in: updateInMock });
    const membersUpdateInMock = jest.fn().mockResolvedValue({ error: null });
    const membersUpdateMock = jest.fn().mockReturnValue({ in: membersUpdateInMock });
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    const fromMock = jest.fn().mockImplementation((table: string) => {
      if (table === "new_family") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              lt: jest.fn().mockReturnValue({
                lt: jest.fn().mockResolvedValue({
                  data: [
                    { id: 1, member_id: 10, step_updated_at: fiveWeeksAgo.toISOString() },
                  ],
                }),
              }),
            }),
          }),
          update: updateMock,
        };
      }
      if (table === "members") {
        return { update: membersUpdateMock };
      }
      if (table === "member_status_log") {
        return { insert: insertMock };
      }
      return {};
    });
    const client = buildMockClient(fromMock);

    const result = await markDroppedOutNewFamilies(client);
    expect(result).toEqual([10]);

    // new_family 업데이트 확인
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ dropped_out: true })
    );

    // members 상태 inactive로 전환 확인
    expect(membersUpdateMock).toHaveBeenCalledWith({ status: "inactive" });
    expect(membersUpdateInMock).toHaveBeenCalledWith("id", [10]);

    // status_log 기록 확인
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        member_id: 10,
        old_status: "new_family",
        new_status: "inactive",
      }),
    ]);
  });

  it("4주 미만 정체 새가족은 이탈 처리하지 않음", async () => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const fromMock = jest.fn().mockImplementation((table: string) => {
      if (table === "new_family") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              lt: jest.fn().mockReturnValue({
                lt: jest.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        };
      }
      return {};
    });
    const client = buildMockClient(fromMock);

    const result = await markDroppedOutNewFamilies(client);
    expect(result).toEqual([]);
  });
});
