import { campaignOpen, normalizePhone } from "../small-group-registration";
import { chapelWallToIso, isoToChapelWall } from "../chapel-time";

describe("공개 순신청 입력", () => {
  test("국가를 고르면 국제 번호로 변환하고 애매한 번호는 거부한다", () => {
    expect(normalizePhone("(415) 555-2671", "US")).toBe("+14155552671");
    expect(normalizePhone("010-1234-5678", "KR")).toBe("+821012345678");
    expect(normalizePhone("415 555 2671", "OTHER")).toBeNull();
    expect(normalizePhone("+442071838750", "OTHER")).toBe("+442071838750");
  });

  test("마감 시각은 접수하지 않는다", () => {
    const campaign = { status: "published", opens_at: "2026-09-22T14:00:00Z", closes_at: "2026-09-30T14:00:00Z" };
    expect(campaignOpen(campaign, Date.parse(campaign.opens_at))).toBe(true);
    expect(campaignOpen(campaign, Date.parse(campaign.closes_at))).toBe(false);
    expect(campaignOpen({ ...campaign, status: "paused" }, Date.parse(campaign.opens_at))).toBe(false);
  });
});

describe("교회 시간대", () => {
  test("뉴욕 시각을 UTC로 정확히 변환한다", () => {
    expect(chapelWallToIso("2026-09-22T10:00")).toBe("2026-09-22T14:00:00.000Z");
    expect(isoToChapelWall("2026-09-22T14:00:00.000Z")).toBe("2026-09-22T10:00");
  });

  test("서머타임으로 없거나 두 번 나타나는 시각은 확인을 요청한다", () => {
    expect(chapelWallToIso("2026-03-08T02:30")).toBeNull();
    expect(chapelWallToIso("2026-11-01T01:30")).toBeNull();
  });
});
