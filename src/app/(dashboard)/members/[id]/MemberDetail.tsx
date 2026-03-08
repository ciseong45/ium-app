"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteMember } from "../actions";
import type { Member } from "@/types/member";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/member";

type StatusLogEntry = {
  id: number;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  profiles: { name: string } | null;
};

export default function MemberDetail({
  member,
  statusLog,
}: {
  member: Member;
  statusLog: StatusLogEntry[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

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
          <button
            onClick={() => router.push(`/members/${member.id}/edit`)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            수정
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            삭제
          </button>
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
