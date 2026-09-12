/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import MemberCareSection from "../MemberCareSection";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("../actions", () => ({ recordCareFollowup: jest.fn() }));

it("열린 돌봄과 공개 범위를 성도 상세에서 보여준다", () => {
  render(
    <MemberCareSection
      memberId={17}
      memberName="윤가람"
      data={{
        openCases: [{
          id: "case-1",
          memberId: 17,
          memberName: "윤가람",
          caseType: "general_care",
          status: "open",
          nextAction: "다음 주 만남 일정 확인",
          dueDate: "2026-09-18",
          assigneeName: "지민",
          lastContactAt: "2026-09-09",
        }],
        logs: [{
          id: "log-1",
          careCaseId: "case-1",
          contactedAt: "2026-09-09",
          authorName: "지민",
          contactMethod: "message",
          outcome: "connected",
          note: "안부 확인",
          visibility: "assigned_leaders",
        }],
        errors: [],
      }}
    />
  );

  expect(screen.getByRole("heading", { name: "목양과 다음 약속" })).toBeInTheDocument();
  expect(screen.getByText("다음 주 만남 일정 확인")).toBeInTheDocument();
  expect(screen.getByText("담당 리더 공유")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "연락 기록 · 다음 약속" })).toBeInTheDocument();
});
