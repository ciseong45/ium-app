/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import CareDashboardPanel from "../CareDashboardPanel";

describe("CareDashboardPanel", () => {
  it("사람, 다음 행동, 담당자와 기한을 먼저 보여준다", () => {
    render(
      <CareDashboardPanel
        today="2026-09-12"
        role="group_leader"
        data={{
          items: [{
            id: "case-1",
            memberId: 17,
            memberName: "윤가람",
            caseType: "general_care",
            status: "open",
            nextAction: "다음 주 만남 일정 확인",
            dueDate: "2026-09-12",
            assigneeName: "지민",
            lastContactAt: "2026-09-09",
          }],
          errors: [],
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "이번 주 목양" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "윤가람" })).toHaveAttribute("href", "/members/17");
    expect(screen.getByText("다음 주 만남 일정 확인")).toBeInTheDocument();
    expect(screen.getByText(/담당 지민/)).toBeInTheDocument();
    expect(screen.getByText("오늘")).toBeInTheDocument();
  });

  it("조회 실패와 할 일 없음 상태를 구분한다", () => {
    const { rerender } = render(
      <CareDashboardPanel
        today="2026-09-12"
        role="admin"
        data={{ items: [], errors: ["돌봄 목록"] }}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("돌봄 목록을 불러오지 못했습니다");

    rerender(
      <CareDashboardPanel
        today="2026-09-12"
        role="admin"
        data={{ items: [], errors: [] }}
      />
    );
    expect(screen.getByText("이번 주 예정된 돌봄이 없습니다.")).toBeInTheDocument();
  });
});
