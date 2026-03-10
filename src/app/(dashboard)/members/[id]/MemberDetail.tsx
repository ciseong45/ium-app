"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteMember, startLeave, returnFromLeave } from "../actions";
import type { Member, MemberLeave, LeaveType, MemberGroupInfo, MinistryTeam } from "@/types/member";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  LEAVE_TYPE_LABELS,
  MINISTRY_TEAM_COLORS,
  MINISTRY_CATEGORY_LABELS,
  getMainStatus,
  getSubStatus,
} from "@/types/member";
import { useRole } from "@/lib/RoleContext";

type StatusLogEntry = {
  id: number;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  profiles: { name: string } | null;
};

type NewFamilyInfo = {
  step: number;
  step_updated_at: string;
} | null;

export default function MemberDetail({
  member,
  statusLog,
  leaves,
  groupInfo,
  newFamilyEntry,
  ministryTeams,
}: {
  member: Member;
  statusLog: StatusLogEntry[];
  leaves: MemberLeave[];
  groupInfo: MemberGroupInfo | null;
  newFamilyEntry?: NewFamilyInfo;
  ministryTeams?: MinistryTeam[];
}) {
  const router = useRouter();
  const role = useRole();
  const [deleting, setDeleting] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showLeaveHistory, setShowLeaveHistory] = useState(false);
  const [showStatusLog, setShowStatusLog] = useState(false);

  const activeLeave = leaves.find((l) => !l.actual_return);
  const pastLeaves = leaves.filter((l) => l.actual_return);
  const mainStatus = getMainStatus(member.status);
  const subStatus = getSubStatus(member.status);

  // 성별 악센트 색상
  const genderAccent =
    member.gender === "M"
      ? "bg-blue-500"
      : member.gender === "F"
        ? "bg-rose-400"
        : "bg-gray-300";

  const genderBgTint =
    member.gender === "M"
      ? "bg-blue-50/40"
      : member.gender === "F"
        ? "bg-rose-50/40"
        : "bg-gray-50";

  const handleDelete = async () => {
    if (!confirm(`정말 ${member.name}님을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      await deleteMember(member.id);
      router.push("/members");
      router.refresh();
    } catch {
      alert("삭제에 실패했습니다.");
      setDeleting(false);
    }
  };

  const handleStartLeave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLeaveLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await startLeave(
        member.id,
        formData.get("leave_type") as LeaveType,
        (formData.get("reason") as string) || null,
        formData.get("start_date") as string,
        (formData.get("expected_return") as string) || null
      );
      setShowLeaveForm(false);
      router.refresh();
    } catch {
      alert("휴적 등록에 실패했습니다.");
    }
    setLeaveLoading(false);
  };

  const handleReturn = async () => {
    if (!activeLeave) return;
    if (!confirm(`${member.name}님의 복귀를 처리하시겠습니까?`)) return;
    try {
      await returnFromLeave(member.id, activeLeave.id);
      router.refresh();
    } catch {
      alert("복귀 처리에 실패했습니다.");
    }
  };

  // 적응 기간 계산
  const adjustingInfo =
    member.status === "adjusting" && newFamilyEntry?.step_updated_at
      ? (() => {
          const completedDate = new Date(newFamilyEntry.step_updated_at);
          const expiryDate = new Date(completedDate);
          expiryDate.setMonth(expiryDate.getMonth() + 3);
          const today = new Date();
          const totalDays = Math.ceil(
            (expiryDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          const elapsedDays = Math.ceil(
            (today.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          const remainingDays = Math.max(0, totalDays - elapsedDays);
          const progress = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
          return { remainingDays, progress, expired: remainingDays <= 0 };
        })()
      : null;

  // 사역팀 카테고리별 분류
  const worshipTeams = (ministryTeams || []).filter((t) => t.category === "worship");
  const discipleshipTeams = (ministryTeams || []).filter((t) => t.category === "discipleship");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* 뒤로가기 + 액션 버튼 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/members")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          목록으로
        </button>
        <div className="flex gap-2">
          {role !== "group_leader" && (
            <button
              onClick={() => router.push(`/members/${member.id}/edit`)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              수정
            </button>
          )}
          {role === "admin" && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {/* ========== 프로필 카드 ========== */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {/* 성별 악센트 바 */}
        <div className={`h-2 ${genderAccent}`} />

        <div className={`p-6 ${genderBgTint}`}>
          {/* 이름 + 상태 배지 */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{member.name}</h2>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${mainStatus.color}`}
                >
                  {mainStatus.label}
                </span>
                {subStatus && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${subStatus.color}`}
                  >
                    {subStatus.label}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-gray-400">
                {member.gender === "M" ? "남" : member.gender === "F" ? "여" : "—"}
              </span>
              {member.is_baptized && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  세례입교
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 기본 정보 그리드 */}
        <div className="border-t px-6 py-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            기본 정보
          </h4>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <InfoItem label="전화번호" value={member.phone} />
            <InfoItem label="이메일" value={member.email} />
            <InfoItem label="생년월일" value={member.birth_date} />
            <InfoItem label="학교/직장" value={member.school_or_work} />
            <InfoItem label="카카오톡 ID" value={member.kakao_id} />
            <InfoItem label="주소" value={member.address} />
            <InfoItem
              label="등록일"
              value={new Date(member.created_at).toLocaleDateString("ko-KR")}
            />
          </dl>
          {member.notes && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3">
              <dt className="text-xs font-medium text-gray-400">메모</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                {member.notes}
              </dd>
            </div>
          )}
        </div>
      </div>

      {/* ========== 순 & 사역팀 카드 ========== */}
      {(groupInfo || (ministryTeams && ministryTeams.length > 0)) && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            소속
          </h4>

          <div className="space-y-3">
            {/* 순 */}
            {groupInfo && (
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-sm font-bold text-blue-600">
                  순
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {groupInfo.upper_room_name
                      ? `${groupInfo.upper_room_name} > ${groupInfo.group_name}`
                      : groupInfo.group_name}
                  </p>
                  {groupInfo.leader_name && (
                    <p className="text-xs text-gray-400">
                      리더: {groupInfo.leader_name}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 사역팀 */}
            {worshipTeams.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-sm font-bold text-indigo-600">
                  예
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {worshipTeams.map((t) => (
                    <span
                      key={t.id}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${MINISTRY_TEAM_COLORS.worship}`}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {discipleshipTeams.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-600">
                  순
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {discipleshipTeams.map((t) => (
                    <span
                      key={t.id}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${MINISTRY_TEAM_COLORS.discipleship}`}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== 적응중 배너 ========== */}
      {adjustingInfo && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-teal-700">적응 기간</h4>
            <span className="text-xs font-medium text-teal-600">
              {adjustingInfo.expired
                ? "만료됨"
                : `${adjustingInfo.remainingDays}일 남음`}
            </span>
          </div>
          {/* 프로그레스 바 */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-teal-100">
            <div
              className="h-full rounded-full bg-teal-500 transition-all"
              style={{ width: `${adjustingInfo.progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-teal-500">
            {adjustingInfo.expired
              ? "적응 기간이 만료되었습니다. 다음 로드 시 출석 멤버로 전환됩니다."
              : "3개월 적응 기간 후 자동으로 출석 멤버로 전환됩니다."}
          </p>
        </div>
      )}

      {/* ========== 현재 휴적 중 알림 ========== */}
      {activeLeave && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-orange-700">현재 휴적 중</span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                {LEAVE_TYPE_LABELS[activeLeave.leave_type]}
              </span>
            </div>
            {role !== "group_leader" && (
              <button
                onClick={handleReturn}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
              >
                복귀 처리
              </button>
            )}
          </div>
          <div className="mt-2 space-y-1 text-sm text-orange-600">
            <p>시작일: {activeLeave.start_date}</p>
            {activeLeave.expected_return && (
              <p>예상 복귀일: {activeLeave.expected_return}</p>
            )}
            {activeLeave.reason && <p>사유: {activeLeave.reason}</p>}
          </div>
        </div>
      )}

      {/* ========== 휴적 관리 (접이식) ========== */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <button
          onClick={() => setShowLeaveHistory(!showLeaveHistory)}
          className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">휴적 관리</h3>
            {pastLeaves.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {pastLeaves.length}
              </span>
            )}
          </div>
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${showLeaveHistory ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showLeaveHistory && (
          <div className="border-t px-5 pb-5">
            {/* 휴적 등록 버튼 */}
            {role !== "group_leader" &&
              !activeLeave &&
              member.status !== "on_leave" &&
              member.status !== "removed" &&
              member.status !== "new_family" && (
                <div className="pt-3">
                  <button
                    onClick={() => setShowLeaveForm(!showLeaveForm)}
                    className="rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 transition-colors"
                  >
                    + 휴적 등록
                  </button>
                </div>
              )}

            {/* 휴적 등록 폼 */}
            {showLeaveForm && (
              <form
                onSubmit={handleStartLeave}
                className="mt-3 rounded-xl border bg-gray-50 p-5 space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      사유 유형 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="leave_type"
                      required
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="military">군대</option>
                      <option value="academic_leave">휴학</option>
                      <option value="study_abroad">유학/교환학생</option>
                      <option value="other">기타</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      시작일 <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="start_date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().split("T")[0]}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      예상 복귀일
                    </label>
                    <input
                      name="expected_return"
                      type="date"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      상세 사유
                    </label>
                    <input
                      name="reason"
                      type="text"
                      placeholder="예: 육군 입대"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={leaveLoading}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                  >
                    {leaveLoading ? "등록 중..." : "휴적 등록"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLeaveForm(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              </form>
            )}

            {/* 과거 휴적 이력 */}
            {pastLeaves.length > 0 ? (
              <div className="mt-3 space-y-2">
                {pastLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm"
                  >
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {LEAVE_TYPE_LABELS[leave.leave_type]}
                    </span>
                    <span className="text-gray-500">
                      {leave.start_date} ~ {leave.actual_return}
                    </span>
                    {leave.reason && (
                      <span className="text-gray-400">{leave.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-400">휴적 이력이 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* ========== 상태 변경 이력 (접이식) ========== */}
      {statusLog.length > 0 && (
        <div className="rounded-2xl border bg-white shadow-sm">
          <button
            onClick={() => setShowStatusLog(!showStatusLog)}
            className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">상태 변경 이력</h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {statusLog.length}
              </span>
            </div>
            <svg
              className={`h-4 w-4 text-gray-400 transition-transform ${showStatusLog ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showStatusLog && (
            <div className="border-t px-5 pb-5">
              <div className="mt-3 space-y-2">
                {statusLog.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm"
                  >
                    <span className="min-w-[70px] text-xs text-gray-400">
                      {new Date(log.changed_at).toLocaleDateString("ko-KR")}
                    </span>
                    <span className="text-gray-500">
                      {log.old_status
                        ? STATUS_LABELS[log.old_status as keyof typeof STATUS_LABELS]
                        : "—"}
                    </span>
                    <svg className="h-3 w-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium text-gray-900">
                      {STATUS_LABELS[log.new_status as keyof typeof STATUS_LABELS]}
                    </span>
                    {log.profiles?.name && (
                      <span className="ml-auto text-xs text-gray-400">
                        {log.profiles.name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}
