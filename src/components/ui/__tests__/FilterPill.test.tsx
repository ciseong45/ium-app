/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import FilterPill from "@/components/ui/FilterPill";

describe("FilterPill", () => {
  it("label 텍스트를 렌더링", () => {
    render(<FilterPill label="전체" active={false} onClick={jest.fn()} />);
    expect(screen.getByText("전체")).toBeInTheDocument();
  });

  it("클릭 시 onClick 호출", () => {
    const handleClick = jest.fn();
    render(<FilterPill label="재적" active={false} onClick={handleClick} />);

    fireEvent.click(screen.getByText("재적"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("active=true일 때 활성 스타일 적용", () => {
    render(<FilterPill label="재적" active={true} onClick={jest.fn()} />);
    const button = screen.getByText("재적");
    expect(button.className).toContain("font-medium");
    expect(button.className).toContain("border-[var(--color-warm-text)]");
  });

  it("active=false일 때 비활성 스타일 적용", () => {
    render(<FilterPill label="새가족" active={false} onClick={jest.fn()} />);
    const button = screen.getByText("새가족");
    expect(button.className).toContain("border-transparent");
    expect(button.className).toContain("text-[var(--color-warm-muted)]");
  });
});
