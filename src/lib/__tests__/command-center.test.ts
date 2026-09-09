import {
  buildInboxDedupeKey,
  canTransitionTask,
  getPreparationStatus,
  getRescheduleImpact,
  sortOperationalTasks,
  todayInTimeZone,
} from "@/lib/command-center";
import type { CommandTask } from "@/types/command-center";

function task(overrides: Partial<CommandTask> = {}): CommandTask {
  return {
    id: "task-1",
    owner_id: "owner-1",
    title: "준비 업무",
    area: "worship_word",
    status: "planned",
    next_action: "원본 확인",
    completion_criteria: null,
    due_date: null,
    scheduled_date: null,
    priority: 2,
    is_required: true,
    due_date_is_manual: false,
    blocked_reason: null,
    ministry_id: null,
    occurrence_id: null,
    source_inbox_id: null,
    template_id: null,
    template_item_key: null,
    relative_due_day: null,
    today_focus_order: null,
    completion_evidence: null,
    started_at: null,
    completed_at: null,
    archived_at: null,
    created_at: "2026-09-08T12:00:00Z",
    updated_at: "2026-09-08T12:00:00Z",
    ...overrides,
  };
}

describe("command center domain rules", () => {
  it("America/New_York 기준으로 날짜를 계산한다", () => {
    expect(todayInTimeZone(new Date("2026-09-09T02:00:00Z"))).toBe("2026-09-08");
  });

  it("수집 원문의 공백·대소문자 차이를 제거해 중복 키를 만든다", () => {
    expect(buildInboxDedupeKey("  야외예배   장소 확인 ")).toBe(
      buildInboxDedupeKey("야외예배 장소 확인")
    );
    expect(buildInboxDedupeKey("ABC")).toBe(buildInboxDedupeKey("abc"));
  });

  it("업무 상태는 설계된 전환만 허용한다", () => {
    expect(canTransitionTask("planned", "in_progress")).toBe(true);
    expect(canTransitionTask("in_progress", "waiting")).toBe(true);
    expect(canTransitionTask("waiting", "completed")).toBe(false);
    expect(canTransitionTask("completed", "in_progress")).toBe(true);
    expect(canTransitionTask("cancelled", "completed")).toBe(false);
  });

  it("필수 업무의 차단 사유나 기한 경과를 조치 필요로 판정한다", () => {
    expect(
      getPreparationStatus([task({ due_date: "2026-09-07" })], "2026-09-08")
    ).toBe("action_required");
    expect(
      getPreparationStatus([task({ blocked_reason: "장소 미정" })], "2026-09-08")
    ).toBe("action_required");
  });

  it("필수 업무의 정보가 빠지면 확인 필요로 판정한다", () => {
    expect(getPreparationStatus([], "2026-09-08")).toBe("needs_information");
    expect(
      getPreparationStatus([task({ next_action: "", due_date: null })], "2026-09-08")
    ).toBe("needs_information");
  });

  it("필수 업무가 모두 완료되어야 준비 완료로 판정한다", () => {
    expect(
      getPreparationStatus(
        [
          task({ status: "completed", completed_at: "2026-09-08T12:00:00Z" }),
          task({ id: "task-2", is_required: false }),
        ],
        "2026-09-08"
      )
    ).toBe("ready");
  });

  it("필수 기한 경과 → 오늘 기한 → 오늘 선택 순으로 정렬한다", () => {
    const sorted = sortOperationalTasks(
      [
        task({ id: "focus", today_focus_order: 1, due_date: "2026-09-12" }),
        task({ id: "today", due_date: "2026-09-08" }),
        task({ id: "overdue", due_date: "2026-09-07" }),
      ],
      "2026-09-08"
    );
    expect(sorted.map((item) => item.id)).toEqual(["overdue", "today", "focus"]);
  });

  it("일정 변경 시 완료 업무와 수동 기한은 유지하고 자동 기한만 이동한다", () => {
    const impact = getRescheduleImpact([
      task({ id: "shift", template_id: "template-1", relative_due_day: -2, due_date: "2026-09-11" }),
      task({ id: "past", template_id: "template-1", relative_due_day: -7, due_date: "2026-09-06" }),
      task({ id: "done", template_id: "template-1", relative_due_day: -4, status: "completed" }),
      task({ id: "manual", template_id: "template-1", relative_due_day: -3, due_date_is_manual: true }),
      task({ id: "unrelated" }),
    ], "2026-09-12", "2026-09-08");

    expect(impact).toEqual({
      shifted: 2,
      preservedCompleted: 1,
      preservedManual: 1,
      needsReschedule: 1,
    });
  });
});
