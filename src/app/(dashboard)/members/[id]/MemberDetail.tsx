"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteMember, startLeave, returnFromLeave } from "../actions";
import type { Member, MemberLeave, LeaveType, MemberGroupInfo } from "@/types/member";
import { STATUS_LABELS, STATUS_COLORS, LEAVE_TYPE_LABELS } from "@/types/member";
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
}: {
  member: Member;
  statusLog: StatusLogEntry[];
  leaves: MemberLeave[];
  groupInfo: MemberGroupInfo | null;
  newFamilyEntry?: NewFamilyInfo;
}) {
  const router = useRouter();
  const role = useRole();
  const [deleting, setDeleting] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const activeLeave = leaves.find((l) => !l.actual_return);

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

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{member.name}</h2>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[member.status]}`}
          >
            {STATUS_LABELS[member.status]}
          </span>
        </div>
        <div className="flex gap-2">
          {role !== "viewer" && (
            <button
              onClick={() => router.push(`/members/${member.id}/edit`)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              수정
            </button>
          )}
          {role === "admin" && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {/* 정보 */}
      <div className="mt-6 rounded-xl border bg-white p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <InfoItem label="전화번호" value={member.phone} />
          <InfoItem label="이메일" value={member.email} />
          <InfoItem
            label="성별"
            value={
              member.gender === "M"
                ? "남"
                : member.gender === "F"
                  ? "여"
                  : null
            }
          />
          <InfoItem label="생년월일" value={member.birth_date} />
          <InfoItem label="카카오톡 ID" value={member.kakao_id} />
          <InfoItem label="학교/직장" value={member.school_or_work} />
          <InfoItem label="세례입교" value={member.is_baptized ? "예" : "아니오"} />
          <InfoItem label="주소" value={member.address} />
          <InfoItem
            label="등록일"
            value={new Date(member.created_at).toLocaleDateString("ko-KR")}
          />
        </dl>
        {member.notes && (
          <div className="mt-4 border-t pt-4">
            <dt className="text-sm font-medium text-gray-500">메모</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
              {member.notes}
            </dd>
          </div>
        )}
      </div>

      {/* 소그룹 소속 */}
      {groupInfo && (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-blue-700">현재 소그룹</h4>
          <div className="mt-2 flex items-center gap-3 text-sm text-blue-600">
            <span className="font-medium">{groupInfo.group_name}</span>
            {groupInfo.leader_name && (
              <span className="text-blue-400">(리더: {groupInfo.leader_name})</span>
            )}
          </div>
        </div>
      )}

      {/* 적응중 기간 표시 */}
      {member.status === "adjusting" && newFamilyEntry?.step_updated_at && (() => {
        const completedDate = new Date(newFamilyEntry.step_updated_at);
        const expiryDate = new Date(completedDate);
        expiryDate.setMonth(expiryDate.getMonth() + 3);
        const today = new Date();
        const remainingDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return (
          <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
            <h4 className="text-sm font-semibold text-teal-700">적응 기간</h4>
            <p className="mt-1 text-sm text-teal-600">
              {remainingDays > 0
                ? `${remainingDays}일 후 자동으로 출석 멤버로 전환됩니다.`
                : "적응 기간이 만료되었습니다. 다음 페이지 로드 시 출석 멤버로 전환됩니다."}
            </p>
          </div>
        );
      })()}

      {/* 휴적 관리 */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">휴적 관리</h3>
          {role !== "viewer" && (
            member.status === "on_leave" && activeLeave ? (
              <button
                onClick={handleReturn}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                복귀 처리
              </button>
            ) : member.status !== "on_leave" && member.status !== "removed" && member.status !== "new_family" ? (
              <button
                onClick={() => setShowLeaveForm(!showLeaveForm)}
                className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50"
              >
                휴적 등록
              </button>
            ) : null
          )}
        </div>

        {/* 현재 휴적 중 알림 */}
        {activeLeave && (
          <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-orange-700">
                현재 휴적 중
              </span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                {LEAVE_TYPE_LABELS[activeLeave.leave_type]}
              </span>
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

        {/* 휴적 등록 폼 */}
        {showLeaveForm && (
          <form
            onSubmit={handleStartLeave}
            className="mt-3 rounded-xl border bg-white p-4 space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
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
                <label className="block text-sm font-medium text-gray-700">
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
                <label className="block text-sm font-medium text-gray-700">
                  예상 복귀일
                </label>
                <input
                  name="expected_return"
                  type="date"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
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
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
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

        {/* 휴적 이력 */}
        {leaves.length > 0 && (
          <div className="mt-3 space-y-2">
            {leaves
              .filter((l) => l.actual_return)
              .map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm"
                >
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
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
        )}
      </div>

      {/* 상태 변경 이력 */}
      {statusLog.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900">
            상태 변경 이력
          </h3>
          <div className="mt-3 space-y-2">
            {statusLog.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm"
              >
                <span className="text-gray-400">
                  {new Date(log.changed_at).toLocaleDateString("ko-KR")}
                </span>
                <span className="text-gray-600">
                  {log.old_status
                    ? STATUS_LABELS[log.old_status as keyof typeof STATUS_LABELS]
                    : "—"}
                </span>
                <span className="text-gray-400">→</span>
                <span className="font-medium text-gray-900">
                  {STATUS_LABELS[log.new_status as keyof typeof STATUS_LABELS]}
                </span>
                {log.profiles?.name && (
                  <span className="text-gray-400">
                    ({log.profiles.name})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 뒤로가기 */}
      <button
        onClick={() => router.push("/members")}
        className="mt-6 text-sm text-gray-500 hover:text-gray-700"
      >
        ← 목록으로
      </button>
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
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}
