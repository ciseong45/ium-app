/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import GlobalError from "@/app/error";

describe("Global error.tsx", () => {
  const mockReset = jest.fn();
  const mockError = new Error("테스트 에러");

  beforeEach(() => {
    mockReset.mockClear();
  });

  it("에러 메시지를 한국어로 렌더링", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByText("문제가 발생했습니다")).toBeInTheDocument();
    expect(screen.getByText("잠시 후 다시 시도해주세요.")).toBeInTheDocument();
  });

  it("다시 시도 버튼이 렌더링됨", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByText("다시 시도")).toBeInTheDocument();
  });

  it("다시 시도 버튼 클릭 시 reset 함수 호출", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByText("다시 시도"));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("에러 세부 정보를 사용자에게 노출하지 않음", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.queryByText("테스트 에러")).not.toBeInTheDocument();
  });
});
