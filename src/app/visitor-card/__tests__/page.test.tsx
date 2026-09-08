/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VisitorCardPage from "../page";
import { submitVisitorCard } from "../actions";

jest.mock("../actions", () => ({
  submitVisitorCard: jest.fn().mockResolvedValue({ success: true }),
}));

describe("방문자 카드 생년월일", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(["2007", "2008", "2009"])("%s년 생년월일을 제출할 수 있다", async (year) => {
    const { container } = render(<VisitorCardPage />);
    const [yearSelect, monthSelect, daySelect] = screen.getAllByRole("combobox");

    expect(screen.getByRole("option", { name: year, exact: true })).toBeInTheDocument();
    fireEvent.change(yearSelect, { target: { value: year } });
    fireEvent.change(monthSelect, { target: { value: "9" } });
    fireEvent.change(daySelect, { target: { value: "8" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(submitVisitorCard).toHaveBeenCalledTimes(1));
    const submitted = jest.mocked(submitVisitorCard).mock.calls[0][0];
    expect(submitted.get("birth_date")).toBe(`${year}-09-08`);
    expect(await screen.findByRole("heading", { name: "환영합니다" })).toBeInTheDocument();
  });

  it("기존 1977년 선택을 유지하고 2010년은 제공하지 않는다", () => {
    render(<VisitorCardPage />);
    expect(screen.getByRole("option", { name: "1977", exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "2010", exact: true })).not.toBeInTheDocument();
  });
});
