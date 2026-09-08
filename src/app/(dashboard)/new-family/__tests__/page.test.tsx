import Page from "../page";
import { requireAuth } from "@/lib/auth";
jest.mock("@/lib/auth", () => ({ requireAuth: jest.fn() }));
jest.mock("../actions", () => ({
  getNewFamilies: jest.fn().mockResolvedValue([]), getActiveMembers: jest.fn().mockResolvedValue([]), getSeasons: jest.fn().mockResolvedValue([]),
}));
jest.mock("../NewFamilyView", () => ({ __esModule: true, default: () => null }));
it("새가족 화면 조회는 상태를 변경하는 쿼리를 실행하지 않는다", async () => {
  const from = jest.fn(() => { throw new Error("조회 화면의 직접 DB 변경 금지"); });
  (requireAuth as jest.Mock).mockResolvedValue({ supabase: { from } });
  await Page({ searchParams: Promise.resolve({}) });
  expect(from).not.toHaveBeenCalled();
});
