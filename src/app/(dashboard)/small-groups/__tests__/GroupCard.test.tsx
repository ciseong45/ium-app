/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import GroupCard from "../[seasonId]/GroupCard";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

// Mock RoleContext
jest.mock("@/lib/RoleContext", () => ({
  useRole: () => "admin",
}));

const baseProps = {
  group: {
    id: 1,
    name: "1순",
    upper_room_id: 1,
    leader: { id: 10, last_name: "김", first_name: "리더" },
  },
  members: [
    {
      id: 100,
      group_id: 1,
      member: {
        id: 2,
        last_name: "박",
        first_name: "철수",
        phone: "010-1234-5678",
        email: null,
        gender: "M" as const,
        birth_date: null,
        address: null,
        status: "active" as const,
        kakao_id: null,
        is_baptized: false,
        school_or_work: null,
        notes: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
    },
    {
      id: 101,
      group_id: 1,
      member: {
        id: 3,
        last_name: "이",
        first_name: "영희",
        phone: null,
        email: null,
        gender: "F" as const,
        birth_date: null,
        address: null,
        status: "active" as const,
        kakao_id: null,
        is_baptized: false,
        school_or_work: null,
        notes: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
    },
  ],
  isAssigning: false,
  unassignedMembers: [],
  upperRooms: [],
  onStartAssign: jest.fn(),
  onAssign: jest.fn(),
  onUnassign: jest.fn(),
  onDelete: jest.fn(),
  onMoveToUpperRoom: jest.fn(),
};

describe("GroupCard - 멤버 이름 클릭 시 상세 페이지 링크", () => {
  it("멤버 이름이 /members/[id] 링크로 렌더링된다", () => {
    render(<GroupCard {...baseProps} />);

    const link1 = screen.getByRole("link", { name: "박철수" });
    expect(link1).toHaveAttribute("href", "/members/2");

    const link2 = screen.getByRole("link", { name: "이영희" });
    expect(link2).toHaveAttribute("href", "/members/3");
  });
});
