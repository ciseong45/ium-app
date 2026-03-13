/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import EmptyState from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("전달된 메시지를 렌더링", () => {
    render(<EmptyState message="데이터가 없습니다." />);
    expect(screen.getByText("데이터가 없습니다.")).toBeInTheDocument();
  });

  it("editorial-divider 요소 포함", () => {
    const { container } = render(<EmptyState message="테스트" />);
    const divider = container.querySelector(".editorial-divider");
    expect(divider).toBeInTheDocument();
  });

  it("다른 메시지도 정상 렌더링", () => {
    render(<EmptyState message="멤버가 없습니다." />);
    expect(screen.getByText("멤버가 없습니다.")).toBeInTheDocument();
  });
});
