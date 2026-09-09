/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from "@/lib/auth";

jest.mock("@/lib/auth");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import {
  applyPreparationTemplate,
  bootstrapFallPlan,
  cancelOccurrence,
  createInboxItem,
  createTask,
  linkMemberToTask,
  recordFollowupResponse,
  refreshPersonReference,
  rescheduleOccurrence,
  setOccurrenceTemplateSkip,
  setPersonTaskLinkArchived,
  setTodayFocus,
  startWaiting,
} from "../actions";

const requireAuthMock = requireAuth as jest.MockedFunction<typeof requireAuth>;

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function query(result: { data?: any; error?: any; count?: number | null } = { data: null, error: null }) {
  const chain: any = {};
  [
    "select", "insert", "update", "delete", "eq", "neq", "in", "is", "not",
    "order", "gte", "lte", "limit", "single", "maybeSingle", "upsert",
  ].forEach((method) => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (value: unknown) => void) => resolve(result);
  return chain;
}

function setup(role = "admin", tableResults: Record<string, ReturnType<typeof query>> = {}) {
  const fallback = query();
  const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
  const supabase = {
    from: jest.fn((table: string) => tableResults[table] ?? fallback),
    rpc,
  };
  requireAuthMock.mockResolvedValue({
    supabase: supabase as any,
    user: { id: "owner-1" } as any,
    role: role as any,
    linkedMemberId: null,
  });
  return { supabase, fallback, rpc };
}

describe("command center actions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("관리자 외 계정의 개인 총괄 기록을 차단한다", async () => {
    setup("upper_room_leader");
    expect(await createInboxItem(form({ content: "요청" }))).toEqual({
      success: false,
      error: "개인 총괄 공간은 관리자만 사용할 수 있습니다.",
    });
  });

  it("수집함은 내용 한 줄만으로 저장한다", async () => {
    const inbox = query({ data: null, error: null });
    const { supabase } = setup("admin", { cc_inbox: inbox });

    expect(await createInboxItem(form({ content: "  야외예배 장소 확인  " }))).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("cc_inbox");
    expect(inbox.insert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: "owner-1", original_text: "야외예배 장소 확인", status: "unprocessed" })
    );
  });

  it("기존 이음앱 멤버 ID를 업무에 연결한다", async () => {
    const { rpc } = setup();
    expect(await linkMemberToTask("task-1", form({ member_id: "17", relationship_label: "새가족 후속" }))).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("cc_link_member_to_task", {
      p_task_id: "task-1",
      p_member_id: 17,
      p_relationship_label: "새가족 후속",
    });
  });

  it("사람 연결의 원본 이름을 새로고침한다", async () => {
    const { rpc } = setup();
    expect(await refreshPersonReference("person-ref-1")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("cc_refresh_person_ref", { p_person_ref_id: "person-ref-1" });
  });

  it("사람과 업무의 연결을 지우지 않고 보관 처리한다", async () => {
    const links = query({ data: null, error: null });
    setup("admin", { cc_person_task_links: links });
    expect(await setPersonTaskLinkArchived("link-1", true)).toEqual({ success: true });
    expect(links.update).toHaveBeenCalledWith(expect.objectContaining({ archived_at: expect.any(String) }));
    expect(links.eq).toHaveBeenCalledWith("id", "link-1");
    expect(links.eq).toHaveBeenCalledWith("owner_id", "owner-1");
  });

  it("진행 상태 업무에는 다음 행동을 요구한다", async () => {
    setup();
    const result = await createTask(form({ title: "공지 작성", status: "in_progress", next_action: "" }));
    expect(result).toEqual({ success: false, error: "다음 행동을 입력해주세요." });
  });

  it("응답 대기 전환 시 상대·요청·다음 확인일을 함께 저장한다", async () => {
    const { rpc } = setup();
    const result = await startWaiting("task-1", form({
      person: "기획팀",
      request: "장소 가능 여부 확인",
      next_check_date: "2026-09-10",
      requested_at: "2026-09-08",
    }));
    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("cc_start_waiting", expect.objectContaining({ p_task_id: "task-1" }));
  });

  it("답변을 받아도 후속 업무를 완료하지 않고 진행으로 복귀시킨다", async () => {
    const { rpc } = setup();
    const result = await recordFollowupResponse("followup-1", form({
      response: "사용 가능",
      next_action: "예약서 제출",
    }));
    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("cc_record_followup_response", expect.objectContaining({
      p_followup_id: "followup-1",
      p_next_action: "예약서 제출",
    }));
  });

  it("오늘 결과물은 3개를 넘을 수 없다", async () => {
    const tasks = query({ data: [{ id: "1" }, { id: "2" }, { id: "3" }], error: null });
    setup("admin", { cc_tasks: tasks });
    expect(await setTodayFocus("task-4", true)).toEqual({
      success: false,
      error: "오늘 끝낼 결과물은 최대 3개까지 선택할 수 있습니다.",
    });
  });

  it("현재 가을 계획은 중복 없이 부트스트랩한다", async () => {
    const { rpc } = setup();
    expect(await bootstrapFallPlan()).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("cc_bootstrap_2026_fall");
  });

  it("선택한 일정에 반복 준비 양식을 적용한다", async () => {
    const { rpc } = setup();
    expect(await applyPreparationTemplate("occurrence-1", form({ template_id: "template-1" }))).toEqual({
      success: true,
      warning: "이미 적용된 양식입니다.",
    });
    expect(rpc).toHaveBeenCalledWith("cc_apply_preparation_template", {
      p_occurrence_id: "occurrence-1",
      p_template_id: "template-1",
    });
  });

  it("일정 변경은 새 날짜와 이유를 함께 전달한다", async () => {
    const { rpc } = setup();
    expect(await rescheduleOccurrence("occurrence-1", form({
      new_date: "2026-09-20",
      reason: "장소 일정 변경",
    }))).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("cc_reschedule_occurrence", expect.objectContaining({
      p_new_date: "2026-09-20",
      p_reason: "장소 일정 변경",
    }));
  });

  it("일정 취소에는 검토 가능한 이유를 요구한다", async () => {
    setup();
    expect(await cancelOccurrence("occurrence-1", form({ reason: "" }))).toEqual({
      success: false,
      error: "취소 이유를 입력해주세요.",
    });
  });

  it("방학 회차는 준비 생성 제외로 기록한다", async () => {
    const { rpc } = setup();
    expect(await setOccurrenceTemplateSkip("occurrence-1", true, form({ reason: "방학" }))).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("cc_skip_occurrence_preparation", {
      p_occurrence_id: "occurrence-1",
      p_reason: "방학",
    });
  });
});
