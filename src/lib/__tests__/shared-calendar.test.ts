import { buildCalendar, calendarRange, occursOn, safeLink, validDate, weekMonday, type SharedSchedule } from "../shared-calendar";
const updated = "2026-09-09T12:00:00Z";
const schedule: SharedSchedule = { id: "one", title: "주일예배", category: "worship", status: "confirmed", start_date: "2026-09-13", end_date: null, start_time: null, location: null, audience: null, coordinator: null, description: null, resource_url: null, service_type: "주일", event_id: null, updated_at: updated, created_at: updated };
const conti = { id: 1, service_date: "2026-09-13", service_type: "주일", updated_at: updated };
const brief = { id: 1, week_date: "2026-09-13", title: "자료", sermon_title: null, sermon_scripture: null, status: "published", updated_at: updated };
const lineup = { id: 1, service_date: "2026-09-13", updated_at: updated };
describe("shared calendar", () => {
  it("merges worship sources into one shared schedule", () => {
    const items = buildCalendar([schedule], [], [conti], [brief], [lineup]);
    expect(items).toHaveLength(1); expect(items[0].links).toHaveLength(3); expect(items[0].status).toBe("confirmed");
  });
  it("separates service types on the same day", () => {
    expect(buildCalendar([], [], [conti, { ...conti, id: 2, service_type: "특별" }], [brief], [lineup])).toHaveLength(2);
  });
  it("does not publish drafts", () => {
    expect(buildCalendar([], [], [], [{ ...brief, status: "draft" }], [])).toHaveLength(0);
  });
  it("preserves cancellation and uses latest resource modification", () => {
    const items = buildCalendar([{ ...schedule, status: "cancelled" }], [], [{ ...conti, updated_at: "2026-09-10T00:00:00Z" }], [], []);
    expect(items[0].status).toBe("cancelled"); expect(items[0].updatedAt).toBe("2026-09-10T00:00:00Z");
  });
  it("uses explicitly linked event as date/name source without duplicates", () => {
    const items = buildCalendar([{ ...schedule, event_id: 3 }], [{ id: 3, name: "변경 행사", event_type: "기타", start_date: "2026-10-04", end_date: "2026-10-06", updated_at: updated }], [], [], []);
    expect(items).toHaveLength(1); expect(items[0].date).toBe("2026-10-04"); expect(items[0].title).toBe("변경 행사");
    expect(occursOn(items[0], "2026-10-05")).toBe(true); expect(occursOn(items[0], "2026-10-07")).toBe(false);
  });
  it("does not infer confirmation from a source record", () => {
    expect(buildCalendar([], [], [conti], [], [])[0].status).toBe("recorded");
  });
  it("calculates Monday-based month grid across year and DST boundaries", () => {
    expect(calendarRange("2026-09-09")).toEqual({ start: "2026-08-31", end: "2026-10-11" });
    expect(weekMonday("2026-11-01")).toBe("2026-10-26");
    expect(weekMonday("2027-01-01")).toBe("2026-12-28");
  });
  it.each(["2026-02-30", "2026-13-01", "bad", "2026-2-01"])("rejects invalid date %s", date => expect(validDate(date)).toBe(false));
  it("accepts leap day", () => expect(validDate("2028-02-29")).toBe(true));
  it.each(["javascript:alert(1)", "data:text/html,hi", "//evil.test", "/\\evil.test", "/bad path"])("rejects unsafe link %s", value => expect(safeLink(value)).toBeNull());
  it.each(["/weekly?date=2026-09-13", "https://example.com/a"])("accepts web link %s", value => expect(safeLink(value)).toBe(value));
});
