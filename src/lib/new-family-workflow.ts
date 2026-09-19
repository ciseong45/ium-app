import type { NewFamilyEntry } from "@/types/new-family";

export type FamilyFilters = {
  quick:
    | "unregistered"
    | "all"
    | "uneducated"
    | "pending"
    | "registered"
    | "archived";
  search: string;
  visitSeason: string;
  course: string;
  education: string;
  registration: string;
  assignee: string;
  from: string;
  to: string;
};
export const DEFAULT_FILTERS: FamilyFilters = {
  quick: "unregistered",
  search: "",
  visitSeason: "",
  course: "",
  education: "",
  registration: "",
  assignee: "",
  from: "",
  to: "",
};
export function educationState(f: NewFamilyEntry) {
  if (f.step === 3 || f.enrollments?.some((e) => e.status === "completed"))
    return "completed";
  if (f.enrollments?.some((e) => e.status === "in_progress") || f.step === 2)
    return "in_progress";
  if (f.enrollments?.some((e) => e.status === "scheduled")) return "scheduled";
  return "not_started";
}
export function registrationState(f: NewFamilyEntry) {
  if (f.registered_at) return "registered";
  return educationState(f) === "completed" ? "pending" : "unregistered";
}
export function filterFamilies(
  families: NewFamilyEntry[],
  filters: FamilyFilters,
  myMemberId: number | null,
) {
  const needle = filters.search.trim().replace(/\s/g, "").toLowerCase();
  return families
    .filter((f) => {
      const registration = registrationState(f);
      const education = educationState(f);
      if (filters.quick === "archived" ? !f.dropped_out : f.dropped_out)
        return false;
      if (filters.quick === "unregistered" && registration === "registered")
        return false;
      if (
        filters.quick === "uneducated" &&
        (education === "completed" || registration === "registered")
      )
        return false;
      if (filters.quick === "pending" && registration !== "pending")
        return false;
      if (filters.quick === "registered" && registration !== "registered")
        return false;
      if (
        needle &&
        !`${f.member.last_name}${f.member.first_name}`
          .replace(/\s/g, "")
          .toLowerCase()
          .includes(needle) &&
        !(
          f.member.phone &&
          /\d/.test(needle) &&
          /^[\d+()\-]+$/.test(needle) &&
          f.member.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, ""))
        )
      )
        return false;
      if (filters.visitSeason && String(f.season_id) !== filters.visitSeason)
        return false;
      if (
        filters.course &&
        !f.enrollments?.some((e) => String(e.course_id) === filters.course)
      )
        return false;
      if (filters.education && education !== filters.education) return false;
      if (filters.registration && registration !== filters.registration)
        return false;
      if (filters.assignee === "unassigned" && f.assigned_to !== null)
        return false;
      if (
        filters.assignee === "mine" &&
        (!myMemberId || f.assigned_to !== myMemberId)
      )
        return false;
      if (
        filters.assignee &&
        !["mine", "unassigned"].includes(filters.assignee) &&
        String(f.assigned_to) !== filters.assignee
      )
        return false;
      if (filters.from && f.first_visit < filters.from) return false;
      if (filters.to && f.first_visit > filters.to) return false;
      return true;
    })
    .sort((a, b) => b.first_visit.localeCompare(a.first_visit) || a.id - b.id);
}
export const EDUCATION_LABELS: Record<string, string> = {
  not_started: "미참여",
  scheduled: "참여 예정",
  in_progress: "참여 중",
  completed: "이수",
};
export const REGISTRATION_LABELS: Record<string, string> = {
  unregistered: "미등록",
  pending: "등록 확정 대기",
  registered: "정식 등록 완료",
};
