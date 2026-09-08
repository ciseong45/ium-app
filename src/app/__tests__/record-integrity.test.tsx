/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Attendance from "@/app/(dashboard)/attendance/AttendanceView";
import Weekly from "@/app/(dashboard)/weekly/WeeklyBriefView";
import { saveGroupAttendance } from "@/app/(dashboard)/attendance/actions";
import { updateBriefTabContent } from "@/app/(dashboard)/weekly/actions";
import type { WeeklyBrief } from "@/types/weekly";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));
jest.mock("@/app/(dashboard)/attendance/actions", () => ({ saveGroupAttendance: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock("@/app/(dashboard)/weekly/actions", () => ({
  createWeeklyBrief: jest.fn(), updateBriefMeta: jest.fn(),
  updateBriefTabContent: jest.fn().mockResolvedValue({ success: true }), autoFillWeeklyBrief: jest.fn(),
}));
const props = {
  groups: [{ id: 1, name: "순", upper_room_name: "다락방", leader_name: null }],
  selectedGroupId: 1, members: [{ id: 1, name: "테스트" }],
  attendance: [{ id: 1, member_id: 1, week_date: "2026-09-06", status: "present" as const, prayer_request: false, prayer_note: null }],
  recentData: { records: [], dates: [] }, selectedDate: "2026-09-06", currentTab: "check",
};
const brief: WeeklyBrief = {
  id: 1, week_date: "2026-09-06", title: null, sermon_title: null, sermon_scripture: null,
  status: "draft", common_content: { text: "이전 내용" }, worship_content: {}, media_content: {},
  newfamily_content: {}, smallgroup_content: {}, created_at: "", updated_at: "1",
};
beforeEach(() => { jest.clearAllMocks(); window.alert = jest.fn(); });

it("날짜 변경 후 해당 날짜의 출석만 저장한다", async () => {
  const { rerender } = render(<Attendance {...props} />);
  rerender(<Attendance {...props} selectedDate="2026-08-30" attendance={[{ ...props.attendance[0], week_date: "2026-08-30", status: "absent" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "출석 저장" }));
  await waitFor(() => expect(saveGroupAttendance).toHaveBeenCalledWith(1, "2026-08-30", expect.arrayContaining([expect.objectContaining({ status: "absent" })])));
});
it("미기록 출석을 연속 결석으로 계산하지 않는다", () => {
  render(<Attendance {...props} currentTab="history" recentData={{ records: [], dates: ["2026-09-06", "2026-08-30", "2026-08-23"] }} />);
  expect(screen.queryByText("3주 이상 연속 결석")).not.toBeInTheDocument();
});
it("주간자료 전체 내용을 지운 상태를 저장할 수 있다", async () => {
  render(<Weekly brief={brief} recentBriefs={[]} selectedDate={brief.week_date} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(updateBriefTabContent).toHaveBeenCalledWith(brief.week_date, "common", { text: "" }));
});
it("주간자료 날짜 변경 시 새 자료를 편집한다", () => {
  const { rerender } = render(<Weekly brief={brief} recentBriefs={[]} selectedDate={brief.week_date} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "미저장 내용" } });
  rerender(<Weekly brief={{ ...brief, id: 2, common_content: { text: "다른 주간" } }} recentBriefs={[]} selectedDate="2026-08-30" />);
  expect(screen.getByRole("textbox")).toHaveValue("다른 주간");
});
it("저장 후 자료가 갱신되어도 편집하던 탭을 유지한다", () => {
  const { rerender } = render(<Weekly brief={{ ...brief, worship_content: { text: "찬양 준비" } }} recentBriefs={[]} selectedDate={brief.week_date} />);
  fireEvent.click(screen.getByRole("button", { name: "찬양팀" }));
  rerender(<Weekly brief={{ ...brief, updated_at: "2", worship_content: { text: "저장된 찬양 준비" } }} recentBriefs={[]} selectedDate={brief.week_date} />);
  expect(screen.getByRole("textbox")).toHaveValue("저장된 찬양 준비");
});
