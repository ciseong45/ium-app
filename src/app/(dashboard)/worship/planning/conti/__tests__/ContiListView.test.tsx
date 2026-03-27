/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import ContiListView from "../ContiListView";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const mockContis = [
  {
    id: 1,
    service_date: "2026-03-29",
    service_type: "주일" as const,
    leader_member_id: 10,
    theme: "부활의 소망",
    scripture: "요한복음 11:25-26",
    description: null,
    discussion_questions: null,
    notes: null,
    created_at: "2026-03-20T00:00:00Z",
    updated_at: "2026-03-20T00:00:00Z",
    leader: { last_name: "김", first_name: "목사" },
    song_count: 4,
  },
  {
    id: 2,
    service_date: "2026-03-22",
    service_type: "주일" as const,
    leader_member_id: 11,
    theme: null,
    scripture: null,
    description: null,
    discussion_questions: null,
    notes: null,
    created_at: "2026-03-15T00:00:00Z",
    updated_at: "2026-03-15T00:00:00Z",
    leader: { last_name: "박", first_name: "전도사" },
    song_count: 0,
  },
];

describe("ContiListView", () => {
  it("콘티 목록이 카드로 렌더링된다", () => {
    render(<ContiListView contis={mockContis} />);

    expect(screen.getByText("예배 콘티")).toBeInTheDocument();
    expect(screen.getByText("부활의 소망")).toBeInTheDocument();
    expect(screen.getByText("요한복음 11:25-26")).toBeInTheDocument();
  });

  it("새 콘티 작성 버튼이 표시된다", () => {
    render(<ContiListView contis={mockContis} />);

    expect(screen.getByText("새 콘티 작성")).toBeInTheDocument();
  });

  it("인도자 이름이 표시된다", () => {
    render(<ContiListView contis={mockContis} />);

    expect(screen.getByText("김목사")).toBeInTheDocument();
    expect(screen.getByText("박전도사")).toBeInTheDocument();
  });

  it("곡 수가 표시된다", () => {
    render(<ContiListView contis={mockContis} />);

    expect(screen.getByText("4곡")).toBeInTheDocument();
  });

  it("콘티가 없을 때 빈 상태가 표시된다", () => {
    render(<ContiListView contis={[]} />);

    expect(screen.getByText("아직 작성된 콘티가 없습니다")).toBeInTheDocument();
  });
});
