/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CareBoard from "../CareBoard";
import { changeCareAction } from "../actions";
import type { CareAction } from "@/lib/care";
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("../actions", () => ({ changeCareAction: jest.fn().mockResolvedValue({ success: true }), createCareAction: jest.fn() }));
const action: CareAction = { id: "00000000-0000-4000-8000-000000000001", member_id: 1, member: { last_name: "테스트", first_name: "사람" }, next_action: "소개 일정 확인", due_date: "2026-09-01", status: "open", assigned_to: "owner", handoff_to: "me", created_by: "owner", version: 1, created_at: "", updated_at: "" };
it("인계받는 사람은 수락하기 전 완료 처리할 수 없다", async () => {
  render(<CareBoard actions={[action]} events={[]} people={[{ id: "owner", name: "기존 담당" }, { id: "me", name: "다음 담당" }]} userId="me" isAdmin={false} today="2026-09-08" />);
  expect(screen.getByText(/담당 기존 담당/)).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "완료" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "처리 저장" }));
  await waitFor(() => expect(changeCareAction).toHaveBeenCalledWith(expect.objectContaining({ id: action.id, version: 1, operation: "accept" })));
});
it("완료한 항목은 진행 중 목록에서 숨기고 완료 목록에서 찾는다", () => {
  render(<CareBoard actions={[{ ...action, status: "completed", handoff_to: null }]} events={[]} people={[]} userId="owner" isAdmin={false} today="2026-09-08" />);
  expect(screen.queryByText(action.next_action)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "완료·취소" }));
  expect(screen.getByText(action.next_action)).toBeInTheDocument();
});
