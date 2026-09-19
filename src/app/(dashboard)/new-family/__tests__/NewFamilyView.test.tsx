/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import NewFamilyView from "../NewFamilyView";
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
  fireEvent.click(screen.getByRole("button", { name: /^등록 확정 대기/ }));
  expect(
    screen.queryByRole("link", { name: "김새가족 상세 보기" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "김이수 상세 보기" }),
  ).toBeInTheDocument();
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
