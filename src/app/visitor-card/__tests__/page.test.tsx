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

  it.each(["1991", "2007", "2008", "2009"])("%s년 생년월일을 제출할 수 있다", async (year) => {
    const { container } = render(<VisitorCardPage />);
    const [yearSelect, monthSelect, daySelect] = screen.getAllByRole("combobox");

    expect(screen.getByRole("option", { name: year })).toBeInTheDocument();
    fireEvent.change(yearSelect, { target: { value: year } });
    fireEvent.change(monthSelect, { target: { value: "9" } });
    fireEvent.change(daySelect, { target: { value: "8" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(submitVisitorCard).toHaveBeenCalledTimes(1));
    const submitted = jest.mocked(submitVisitorCard).mock.calls[0][0];
    expect(submitted.get("birth_date")).toBe(`${year}-09-08`);
    expect(await screen.findByRole("heading", { name: "환영합니다" })).toBeInTheDocument();
  });

  it("1991년 이전과 2009년 이후 출생연도는 제공하지 않는다", () => {
    render(<VisitorCardPage />);
    expect(screen.queryByRole("option", { name: "1990" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "1977" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "2010" })).not.toBeInTheDocument();
  });
});
