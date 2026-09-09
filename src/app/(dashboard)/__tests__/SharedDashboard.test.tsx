/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SharedDashboard from "../SharedDashboard";
import { buildCalendar } from "@/lib/shared-calendar";
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("../shared-dashboard-actions", () => ({ saveSharedSchedule: jest.fn(), saveDashboardNotice: jest.fn() }));
const items = buildCalendar([], [{ id: 1, name: "공동 행사", event_type: "기타", start_date: "2026-09-13", end_date: null, updated_at: "2026-09-09" }], [], [], []);
const data = { items, notices: [], deadlines: [], resources: [], currentBrief: null, errors: [] };
it("shows calendar and no summer application or non-admin edit controls", () => {
  render(<SharedDashboard data={data} today="2026-09-09" anchor="2026-09-09" view="week" canManage={false} />);
  expect(screen.getByRole("heading", { name: "통합 캘린더" })).toBeInTheDocument();
  expect(screen.queryByText(/여름순 신청/)).not.toBeInTheDocument();
  expect(screen.queryByText("+ 공동 일정 등록")).not.toBeInTheDocument();
  expect(screen.queryByText("+ 대시보드 공지 등록")).not.toBeInTheDocument();
});
it("filters categories and opens schedule details", () => {
  render(<SharedDashboard data={data} today="2026-09-09" anchor="2026-09-09" view="week" canManage={false} />);
  fireEvent.click(screen.getAllByRole("button", { name: /공동 행사/ })[0]);
  expect(screen.getByRole("region", { name: "일정 상세" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "일정 상세 닫기" }));
  fireEvent.click(screen.getByRole("button", { name: "예배" }));
  expect(screen.queryAllByRole("button", { name: /공동 행사/ })).toHaveLength(0);
  expect(screen.getByText("이 기간에 표시할 일정이 없습니다.")).toBeInTheDocument();
});
it("shows partial source failures and admin forms", () => {
  render(<SharedDashboard data={{ ...data, errors: ["공동 일정"] }} today="2026-09-09" anchor="2026-09-09" view="month" canManage />);
  expect(screen.getByRole("alert")).toHaveTextContent("공동 일정");
  expect(screen.getByText("+ 공동 일정 등록")).toBeInTheDocument();
  expect(screen.getByText("+ 대시보드 공지 등록")).toBeInTheDocument();
});
