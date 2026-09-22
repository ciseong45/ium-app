/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewFamilyView from "../NewFamilyView";
import { updateEducationProgress } from "../actions";
import type { NewFamilyEntry } from "@/types/new-family";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/lib/RoleContext", () => ({
  useRole: () => "admin",
}));

jest.mock("../actions", () => ({
  createNewFamily: jest.fn(),
  updateStep: jest.fn(),
  completeConnection: jest.fn(),
  deleteNewFamily: jest.fn(),
  restoreNewFamily: jest.fn(),
  updateEducationProgress: jest.fn().mockResolvedValue({ success: true }),
}));

const family: NewFamilyEntry = {
  id: 1,
  member_id: 101,
  first_visit: "2026-09-01",
  step: 1,
  step_updated_at: "2026-09-01T00:00:00Z",
  assigned_to: null,
  season_id: null,
  notes: null,
  dropped_out: false,
  dropped_out_at: null,
  created_at: "2026-09-01T00:00:00Z",
  member: {
    id: 101,
    last_name: "김",
    first_name: "새가족",
    phone: "010-1234-5678",
    status: "new_family",
  },
  assignee: null,
};

describe("NewFamilyView", () => {
  it("새가족 이름에서 멤버 상세 페이지로 이동할 수 있다", () => {
    render(<NewFamilyView families={[family]} members={[]} seasons={[]} />);

    expect(
      screen.getByRole("link", { name: "김새가족 상세 보기" }),
    ).toHaveAttribute("href", "/members/101");
  });
});

it("등록 확정 대기 필터는 이수자만 표시한다", () => {
  render(
    <NewFamilyView
      families={[
        family,
        {
          ...family,
          id: 2,
          step: 3,
          member: { ...family.member, id: 102, first_name: "이수" },
        },
      ]}
      members={[]}
      seasons={[]}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: /^등록 확정 대기/ }));
  expect(
    screen.queryByRole("link", { name: "김새가족 상세 보기" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "김이수 상세 보기" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "김이수 관리" }));
  expect(
    screen.getByRole("button", { name: "정식 등록 확정" }),
  ).toBeInTheDocument();
});
it("검색 결과가 없을 때 초기화로 기본 명단을 복원한다", () => {
  render(<NewFamilyView families={[family]} members={[]} seasons={[]} />);
  fireEvent.change(screen.getByLabelText("이름·연락처 검색"), {
    target: { value: "없는사람" },
  });
  expect(screen.getByText(/조건에 맞는 명단이 없습니다/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
  expect(
    screen.getByRole("link", { name: "김새가족 상세 보기" }),
  ).toBeInTheDocument();
});

it("첫 화면은 명단만 보여주고 선택한 사람의 관리 항목만 펼친다", () => {
  render(<NewFamilyView families={[family]} members={[]} seasons={[]} />);
  expect(
    screen.queryByRole("region", { name: "상세 필터" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "교육 기록 저장" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "김새가족 관리" }));
  expect(
    screen.getByRole("button", { name: "교육 기록 저장" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "김새가족 관리 닫기" }));
  expect(
    screen.queryByRole("button", { name: "교육 기록 저장" }),
  ).not.toBeInTheDocument();
});
it("상세 필터를 접어도 선택한 조건을 유지하고 적용 수를 표시한다", () => {
  render(<NewFamilyView families={[family]} members={[]} seasons={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "상세 필터" }));
  fireEvent.change(screen.getByRole("combobox", { name: "교육 상태" }), {
    target: { value: "completed" },
  });
  fireEvent.click(screen.getByRole("button", { name: "상세 필터 1" }));
  expect(
    screen.queryByRole("region", { name: "상세 필터" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("검색 결과 0명")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
  expect(screen.getByText("검색 결과 1명")).toBeInTheDocument();
});

it("진행 상태에서 교육 주차 편집을 열 수 있다", () => {
  render(
    <NewFamilyView
      families={[family]}
      members={[]}
      seasons={[]}
      courses={[
        {
          id: 9,
          season_id: 1,
          name: "가을",
          starts_on: "2026-09-01",
          total_weeks: 3,
        },
      ]}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "김새가족 진행 상태 변경" }),
  );
  expect(
    screen.getByRole("combobox", { name: "김새가족 교육 주차" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "정식 등록 확정" }),
  ).not.toBeInTheDocument();
});
it("수료 탭에서 마지막 주차와 수료자를 함께 관리한다", () => {
  render(
    <NewFamilyView
      families={[
        family,
        {
          ...family,
          id: 2,
          step: 2,
          member: { ...family.member, first_name: "대기" },
          enrollments: [
            {
              id: 1,
              course_id: 9,
              status: "in_progress",
              completed_at: null,
              current_week: 3,
            },
          ],
        },
      ]}
      members={[]}
      seasons={[]}
      courses={[
        {
          id: 9,
          season_id: 1,
          name: "가을",
          starts_on: "2026-09-01",
          total_weeks: 3,
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: /^수료/ }));
  expect(
    screen.queryByRole("link", { name: "김새가족 상세 보기" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "김대기 수료 처리" }),
  ).toBeInTheDocument();
});

it("주차 저장은 수료하지 않고 선택한 교육 차수에만 반영한다", async () => {
  jest.mocked(updateEducationProgress).mockClear();
  render(
    <NewFamilyView
      families={[family]}
      members={[]}
      seasons={[]}
      courses={[
        {
          id: 9,
          season_id: 1,
          name: "가을",
          starts_on: "2026-09-01",
          total_weeks: 4,
        },
      ]}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "김새가족 진행 상태 변경" }),
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "김새가족 교육 차수" }),
    { target: { value: "9" } },
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "김새가족 교육 주차" }),
    { target: { value: "4" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "교육 기록 저장" }));
  await waitFor(() =>
    expect(updateEducationProgress).toHaveBeenCalledWith(1, 9, 4),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("form", { name: "김새가족 교육 진도" }),
    ).not.toBeInTheDocument(),
  );
});
it("저장 실패 시 편집 내용을 유지하고 오류를 표시한다", async () => {
  jest
    .mocked(updateEducationProgress)
    .mockResolvedValueOnce({ success: false, error: "저장 실패" });
  render(
    <NewFamilyView
      families={[family]}
      members={[]}
      seasons={[]}
      courses={[
        {
          id: 9,
          season_id: 1,
          name: "가을",
          starts_on: "2026-09-01",
          total_weeks: 3,
        },
      ]}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "김새가족 진행 상태 변경" }),
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "김새가족 교육 차수" }),
    { target: { value: "9" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "교육 기록 저장" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("저장 실패"),
  );
  expect(
    screen.getByRole("combobox", { name: "김새가족 교육 차수" }),
  ).toHaveValue("9");
});
