/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import NotFound from "@/app/not-found";

describe("Global not-found.tsx", () => {
  it("404 메시지를 한국어로 렌더링", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("페이지를 찾을 수 없습니다")).toBeInTheDocument();
  });

  it("대시보드로 돌아가기 링크 렌더링", () => {
    render(<NotFound />);
    const link = screen.getByText("대시보드로 돌아가기");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });
});
