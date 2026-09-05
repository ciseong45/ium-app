/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
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
    render(
      <NewFamilyView
        families={[family]}
        members={[]}
        seasons={[]}
      />
    );

    expect(screen.getByRole("link", { name: "김새가족 상세 보기" })).toHaveAttribute(
      "href",
      "/members/101"
    );
  });
});
