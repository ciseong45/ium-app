/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from "@/lib/auth";

jest.mock("@/lib/auth");

import { GET } from "../export/route";

const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;

function query(data: any[] = []) {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.then = (resolve: (value: unknown) => void) => resolve({ data, error: null });
  return chain;
}

describe("command center export", () => {
  it("관리자 외 계정에는 내보내기를 허용하지 않는다", async () => {
    requireAuthMock.mockResolvedValue({ role: "group_leader" } as any);
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("ID와 변경 이력을 포함한 읽을 수 있는 JSON 백업을 만든다", async () => {
    const supabase = { from: jest.fn(() => query([{ id: "record-1" }])) };
    requireAuthMock.mockResolvedValue({
      role: "admin",
      user: { id: "owner-1" },
      supabase,
    } as any);

    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("ium-command-center-");
    expect(payload).toEqual(expect.objectContaining({
      timezone: "America/New_York",
      cc_tasks: [{ id: "record-1" }],
      cc_change_log: [{ id: "record-1" }],
    }));
  });
});
