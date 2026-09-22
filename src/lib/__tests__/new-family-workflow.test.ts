import {
  filterFamilies,
  registrationState,
  educationState,
  DEFAULT_FILTERS,
  graduationReady,
  progressLabel,
} from "../new-family-workflow";
import type { NewFamilyEntry } from "@/types/new-family";
const entry = (patch: Partial<NewFamilyEntry> = {}): NewFamilyEntry => ({
  id: 1,
  member_id: 10,
  first_visit: "2026-03-01",
  step: 1,
  step_updated_at: "2026-03-01",
  assigned_to: null,
  season_id: 1,
  notes: null,
  dropped_out: false,
  dropped_out_at: null,
  created_at: "2026-03-01",
  member: {
    id: 10,
    last_name: "김",
    first_name: "방문",
    phone: "010-1234-5678",
    status: "visitor",
  },
  assignee: null,
  enrollments: [],
  registered_at: null,
  registered_by: null,
  registration_source: null,
  ...patch,
});
it("오래 기다린 방문자도 기본 명단에 남는다", () => {
  expect(filterFamilies([entry()], DEFAULT_FILTERS, null)).toHaveLength(1);
});
it("교육 이수만으로 정식 등록하지 않는다", () => {
  const family = entry({ step: 3 });
  expect(educationState(family)).toBe("completed");
  expect(registrationState(family)).toBe("pending");
});
it("등록 기록 없이 다른 멤버 상태라는 이유로 완료 처리하지 않는다", () => {
  expect(
    registrationState(
      entry({ step: 3, member: { ...entry().member, status: "inactive" } }),
    ),
  ).toBe("pending");
});
it("등록 완료자는 기본 명단에서 제외되고 완료 필터에서 찾을 수 있다", () => {
  const family = entry({
    registered_at: "2026-09-19",
    registration_source: "confirmed",
    registered_by: "user-1",
  });
  expect(filterFamilies([family], DEFAULT_FILTERS, null)).toHaveLength(0);
  expect(
    filterFamilies([family], { ...DEFAULT_FILTERS, quick: "registered" }, null),
  ).toHaveLength(1);
});
it("전화번호 표기와 관계없이 검색하고 담당자 미지정 필터를 조합한다", () => {
  expect(
    filterFamilies(
      [entry()],
      { ...DEFAULT_FILTERS, search: "0101234", assignee: "unassigned" },
      null,
    ),
  ).toHaveLength(1);
});
it("방문 학기와 교육 차수는 독립적으로 조합한다", () => {
  const family = entry({
    enrollments: [
      { id: 1, course_id: 9, status: "scheduled", completed_at: null },
    ],
  });
  expect(
    filterFamilies(
      [family],
      {
        ...DEFAULT_FILTERS,
        visitSeason: "1",
        course: "9",
        education: "scheduled",
      },
      null,
    ),
  ).toHaveLength(1);
  expect(
    filterFamilies(
      [family],
      { ...DEFAULT_FILTERS, visitSeason: "2", course: "9" },
      null,
    ),
  ).toHaveLength(0);
});
it("계정에 연결된 사람이 없으면 내 담당은 빈 결과다", () => {
  expect(
    filterFamilies([entry()], { ...DEFAULT_FILTERS, assignee: "mine" }, null),
  ).toHaveLength(0);
});
it("기간 양끝을 포함하고 보관한 명단은 명시적으로 조회한다", () => {
  const family = entry({ dropped_out: true });
  expect(filterFamilies([family], DEFAULT_FILTERS, null)).toHaveLength(0);
  expect(
    filterFamilies(
      [family],
      {
        ...DEFAULT_FILTERS,
        quick: "archived",
        from: "2026-03-01",
        to: "2026-03-01",
      },
      null,
    ),
  ).toHaveLength(1);
});

it("마지막 주차는 수료 대기이며 수료 자체와 구분한다", () => {
  const f = entry({
    step: 2,
    enrollments: [
      {
        id: 1,
        course_id: 9,
        status: "in_progress",
        completed_at: null,
        current_week: 3,
      },
    ],
  });
  const courses = [
    {
      id: 9,
      season_id: 1,
      name: "가을",
      starts_on: "2026-09-01",
      total_weeks: 3,
    },
  ];
  expect(graduationReady(f, courses)).toBe(true);
  expect(educationState(f)).toBe("in_progress");
  expect(registrationState(f)).toBe("unregistered");
  expect(progressLabel(f)).toBe("교육 3주차");
  expect(
    filterFamilies(
      [f],
      { ...DEFAULT_FILTERS, quick: "graduation" },
      null,
      courses,
    ),
  ).toHaveLength(1);
  expect(
    filterFamilies(
      [entry()],
      { ...DEFAULT_FILTERS, quick: "graduation" },
      null,
      courses,
    ),
  ).toHaveLength(0);
});
it("수료 탭은 등록 완료 후에도 교육 수료 이력을 보존한다", () => {
  const f = entry({ step: 3, registered_at: "2026-09-22" });
  expect(
    filterFamilies([f], { ...DEFAULT_FILTERS, quick: "graduation" }, null),
  ).toHaveLength(1);
  expect(progressLabel(f)).toBe("수료 완료");
});
