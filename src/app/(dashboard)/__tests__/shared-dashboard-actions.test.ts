import { requireAuth } from "@/lib/auth";
import { saveSharedSchedule, saveDashboardNotice, getSharedDashboard } from "../shared-dashboard-actions";
jest.mock("@/lib/auth", () => ({ requireAuth: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const auth = jest.mocked(requireAuth);
const from = jest.fn();
beforeEach(() => { jest.clearAllMocks(); auth.mockResolvedValue({ role: "admin", user: { id: "admin" }, supabase: { from } } as unknown as Awaited<ReturnType<typeof requireAuth>>); });
it.each(["group_leader", "upper_room_leader"])("rejects shared writes by %s before querying", async role => {
  auth.mockResolvedValue({ role, supabase: { from } } as unknown as Awaited<ReturnType<typeof requireAuth>>);
  expect((await saveSharedSchedule(new FormData())).success).toBe(false);
  expect((await saveDashboardNotice(new FormData())).success).toBe(false);
  expect(from).not.toHaveBeenCalled();
});
it("validates date query arguments", async () => {
  await expect(getSharedDashboard("invalid", "2026-09-09")).rejects.toThrow("날짜");
  expect(from).not.toHaveBeenCalled();
});
it("rejects inverted notice dates", async () => {
  const f = new FormData(); Object.entries({ title: "공지", body: "내용", start_date: "2026-09-10", end_date: "2026-09-09" }).forEach(([k,v]) => f.set(k,v));
  expect((await saveDashboardNotice(f)).success).toBe(false); expect(from).not.toHaveBeenCalled();
});
it("rejects unsafe schedule links", async () => {
  const f = new FormData(); Object.entries({ title: "일정", category: "event", status: "tentative", start_date: "2026-09-09", resource_url: "javascript:alert(1)" }).forEach(([k,v]) => f.set(k,v));
  expect((await saveSharedSchedule(f)).success).toBe(false); expect(from).not.toHaveBeenCalled();
});
it("inserts validated shared event with audit user", async () => {
  const insert = jest.fn().mockResolvedValue({ error: null }); from.mockReturnValue({ insert });
  const f = new FormData(); Object.entries({ title: "일정", category: "event", status: "tentative", start_date: "2026-09-09" }).forEach(([k,v]) => f.set(k,v));
  expect((await saveSharedSchedule(f)).success).toBe(true);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ created_by: "admin", title: "일정", service_type: null, start_time: null }));
});
