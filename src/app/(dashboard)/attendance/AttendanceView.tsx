"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { saveAttendance } from "./actions";
import type { AttendanceStatus, AttendanceRecord } from "@/types/attendance";
import { useRole } from "@/lib/RoleContext";
import FilterPill from "@/components/ui/FilterPill";

type Member = { id: number; name: string; status: string };

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "출석", color: "bg-green-100 text-green-700" },
  { value: "online", label: "온라인", color: "bg-blue-100 text-blue-700" },
  { value: "absent", label: "결석", color: "bg-red-100 text-red-700" },
];

export default function AttendanceView({
  members,
  attendance,
  recentData,
  attendanceDates,
  selectedDate,
  currentTab,
}: {
  members: Member[];
  attendance: AttendanceRecord[];
  recentData: { records: AttendanceRecord[]; dates: string[] };
  attendanceDates: string[];
  selectedDate: string;
  currentTab: string;
}) {
  const router = useRouter();
  const tab = currentTab;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">출석 관리</h2>

      {/* 탭 */}
      <div className="mt-4 flex gap-1">
        {[
          { value: "check", label: "출석 체크" },
          { value: "history", label: "출석 현황" },
        ].map((t) => (
          <FilterPill
            key={t.value}
            label={t.label}
            active={tab === t.value}
            onClick={() =>
              router.push(`/attendance?tab=${t.value}&date=${selectedDate}`)
            }
          />
        ))}
      </div>

      {tab === "check" ? (
        <AttendanceCheck
          members={members}
          attendance={attendance}
          selectedDate={selectedDate}
        />
      ) : (
        <AttendanceHistory
          members={members}
          recentData={recentData}
          attendanceDates={attendanceDates}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}

// ===== 출석 체크 탭 =====
function AttendanceCheck({
  members,
  attendance,
  selectedDate,
}: {
  members: Member[];
  attendance: AttendanceRecord[];
  selectedDate: string;
}) {
  const router = useRouter();
  const role = useRole();

  // 기존 출석 데이터로 초기값 설정
  const initialStatuses: Record<number, AttendanceStatus | ""> = {};
  members.forEach((m) => {
    const record = attendance.find((a) => a.member_id === m.id);
    initialStatuses[m.id] = record ? record.status : "";
  });

  const [statuses, setStatuses] =
    useState<Record<number, AttendanceStatus | "">>(initialStatuses);
  const [saving, setSaving] = useState(false);

  const handleStatusChange = (memberId: number, status: AttendanceStatus) => {
    setStatuses((prev) => ({
      ...prev,
      [memberId]: prev[memberId] === status ? "" : status,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const records = Object.entries(statuses)
      .filter(([, status]) => status !== "")
      .map(([memberId, status]) => ({
        member_id: Number(memberId),
        status: status as AttendanceStatus,
      }));

    const result = await saveAttendance(selectedDate, records);
    if (result.success) {
      router.refresh();
      alert("저장되었습니다.");
    } else {
      alert(result.error);
    }
    setSaving(false);
  };

  // 전체 선택 기능
  const handleSelectAll = (status: AttendanceStatus) => {
    const newStatuses: Record<number, AttendanceStatus | ""> = {};
    members.forEach((m) => {
      newStatuses[m.id] = status;
    });
    setStatuses(newStatuses);
  };

  const checkedCount = Object.values(statuses).filter((s) => s !== "").length;
  const presentCount = Object.values(statuses).filter(
    (s) => s === "present"
  ).length;
  const onlineCount = Object.values(statuses).filter(
    (s) => s === "online"
  ).length;

  return (
    <div className="mt-6">
      {/* 날짜 선택 */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => router.push(`/attendance?tab=check&date=${e.target.value}`)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-500">
          {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>

      {/* 요약 + 전체 선택 */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500">
          {checkedCount}/{members.length}명 체크 (출석 {presentCount}, 온라인{" "}
          {onlineCount})
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => handleSelectAll("present")}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-green-50"
          >
            전체 출석
          </button>
          <button
            onClick={() => handleSelectAll("absent")}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-red-50"
          >
            전체 결석
          </button>
        </div>
      </div>

      {/* 멤버별 출석 체크 */}
      <div className="mt-4 space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg border bg-white px-4 py-3"
          >
            <span className="text-sm font-medium text-gray-900">
              {member.name}
            </span>
            <div className="flex gap-1.5">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(member.id, option.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statuses[member.id] === option.value
                      ? option.color
                      : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 저장 버튼 */}
      {role !== "viewer" && (
        <div className="mt-6 sticky bottom-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white shadow-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "출석 저장"}
          </button>
        </div>
      )}
    </div>
  );
}

// ===== 출석 현황 탭 =====
function AttendanceHistory({
  members,
  recentData,
  attendanceDates,
  selectedDate,
}: {
  members: Member[];
  recentData: { records: AttendanceRecord[]; dates: string[] };
  attendanceDates: string[];
  selectedDate: string;
}) {
  const router = useRouter();
  const { records, dates } = recentData;

  // 멤버별 최근 출석 데이터 매핑
  const memberAttendance = useMemo(() => {
    const result = members.map((member) => {
      const memberRecords = records.filter((r) => r.member_id === member.id);
      const weekData = dates.map((date) => {
        const record = memberRecords.find((r) => r.week_date === date);
        return record ? record.status : null;
      });

      let consecutiveAbsent = 0;
      for (const status of weekData) {
        if (status === "absent" || status === null) {
          consecutiveAbsent++;
        } else {
          break;
        }
      }

      return { member, weekData, consecutiveAbsent };
    });

    result.sort((a, b) => b.consecutiveAbsent - a.consecutiveAbsent);
    return result;
  }, [members, records, dates]);

  // 주간 출석률 계산
  const weeklyStats = useMemo(() => dates.map((date) => {
    const weekRecords = records.filter((r) => r.week_date === date);
    const present = weekRecords.filter(
      (r) => r.status === "present" || r.status === "online"
    ).length;
    return {
      date,
      total: weekRecords.length,
      present,
      rate: weekRecords.length > 0 ? Math.round((present / weekRecords.length) * 100) : 0,
    };
  }), [records, dates]);

  const statusIcon = (status: string | null) => {
    switch (status) {
      case "present":
        return "●";
      case "online":
        return "◐";
      case "absent":
        return "○";
      default:
        return "—";
    }
  };

  const statusColor = (status: string | null) => {
    switch (status) {
      case "present":
        return "text-green-500";
      case "online":
        return "text-blue-500";
      case "absent":
        return "text-red-400";
      default:
        return "text-gray-300";
    }
  };

  return (
    <div className="mt-6">
      {/* 주간 출석률 */}
      {weeklyStats.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700">주간 출석률</h3>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
            {weeklyStats.map((week) => (
              <div
                key={week.date}
                className="flex min-w-[80px] flex-col items-center rounded-lg border bg-white p-3"
              >
                <span className="text-xs text-gray-400">
                  {new Date(week.date + "T00:00:00").toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="mt-1 text-lg font-bold text-gray-900">
                  {week.rate}%
                </span>
                <span className="text-xs text-gray-400">
                  {week.present}/{week.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 연속 결석 경고 */}
      {memberAttendance.filter((m) => m.consecutiveAbsent >= 3).length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-700">
            3주 이상 연속 결석
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {memberAttendance
              .filter((m) => m.consecutiveAbsent >= 3)
              .map((m) => (
                <span
                  key={m.member.id}
                  className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700"
                >
                  {m.member.name} ({m.consecutiveAbsent}주)
                </span>
              ))}
          </div>
        </div>
      )}

      {/* 출석 현황 테이블 */}
      {dates.length === 0 ? (
        <p className="text-center text-gray-400">출석 기록이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="sticky left-0 bg-gray-50 pb-3 pr-4 text-left font-medium">
                  이름
                </th>
                {dates.map((date) => (
                  <th
                    key={date}
                    className="pb-3 px-2 text-center font-medium whitespace-nowrap"
                  >
                    {new Date(date + "T00:00:00").toLocaleDateString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberAttendance.map(({ member, weekData, consecutiveAbsent }) => (
                <tr
                  key={member.id}
                  className={`border-b ${consecutiveAbsent >= 3 ? "bg-red-50" : ""}`}
                >
                  <td className="sticky left-0 bg-inherit py-2.5 pr-4 font-medium text-gray-900">
                    {member.name}
                  </td>
                  {weekData.map((status, i) => (
                    <td
                      key={dates[i]}
                      className={`py-2.5 px-2 text-center ${statusColor(status)}`}
                    >
                      {statusIcon(status)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 범례 */}
      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <span>
          <span className="text-green-500">●</span> 출석
        </span>
        <span>
          <span className="text-blue-500">◐</span> 온라인
        </span>
        <span>
          <span className="text-red-400">○</span> 결석
        </span>
        <span>
          <span className="text-gray-300">—</span> 미체크
        </span>
      </div>
    </div>
  );
}
