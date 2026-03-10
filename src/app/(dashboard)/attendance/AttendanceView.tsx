"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { saveGroupAttendance } from "./actions";
import type { GroupOption } from "./actions";
import type { AttendanceStatus, AttendanceRecord } from "@/types/attendance";
import FilterPill from "@/components/ui/FilterPill";

type Member = { id: number; name: string };

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "출석", color: "bg-green-100 text-green-700" },
  { value: "absent", label: "결석", color: "bg-red-100 text-red-700" },
];

export default function AttendanceView({
  groups,
  selectedGroupId,
  members,
  attendance,
  recentData,
  selectedDate,
  currentTab,
}: {
  groups: GroupOption[];
  selectedGroupId: number | null;
  members: Member[];
  attendance: AttendanceRecord[];
  recentData: { records: AttendanceRecord[]; dates: string[] };
  selectedDate: string;
  currentTab: string;
}) {
  const router = useRouter();
  const tab = currentTab;

  const buildUrl = (params: Record<string, string | number | null>) => {
    const base: Record<string, string> = {};
    if (selectedGroupId) base.group = String(selectedGroupId);
    base.date = selectedDate;
    base.tab = tab;
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined) base[k] = String(v);
    });
    const qs = new URLSearchParams(base).toString();
    return `/attendance?${qs}`;
  };

  return (
    <div>
      <h2 className="font-serif text-2xl font-light tracking-tight text-[var(--color-warm-text)]">출석 관리</h2>

      {/* 순 선택 */}
      {groups.length > 1 && (
        <div className="mt-4">
          <select
            value={selectedGroupId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                router.push(`/attendance?group=${val}&date=${selectedDate}&tab=${tab}`);
              } else {
                router.push(`/attendance?date=${selectedDate}&tab=${tab}`);
              }
            }}
            className="w-full rounded-lg border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] px-3.5 py-2.5 text-sm text-[var(--color-warm-text)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/10"
          >
            <option value="">순을 선택하세요</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.upper_room_name}){g.leader_name ? ` - ${g.leader_name}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 순 하나만 있으면 순 이름 표시 */}
      {groups.length === 1 && (
        <p className="mt-2 text-sm text-[var(--color-warm-muted)]">
          {groups[0].name} ({groups[0].upper_room_name})
        </p>
      )}

      {/* 순 미선택 시 안내 */}
      {!selectedGroupId && groups.length > 1 && (
        <div className="mt-12 text-center text-[var(--color-warm-muted)]">
          <p className="text-4xl">👆</p>
          <p className="mt-2">순을 선택하면 출석을 관리할 수 있습니다.</p>
        </div>
      )}

      {/* 순 없음 */}
      {groups.length === 0 && (
        <div className="mt-12 text-center text-[var(--color-warm-muted)]">
          <p className="text-4xl">🚫</p>
          <p className="mt-2">접근 가능한 순이 없습니다.</p>
          <p className="text-xs mt-1">관리자에게 문의하세요.</p>
        </div>
      )}

      {/* 순 선택된 경우 */}
      {selectedGroupId && (
        <>
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
                  router.push(
                    `/attendance?group=${selectedGroupId}&tab=${t.value}&date=${selectedDate}`
                  )
                }
              />
            ))}
          </div>

          {tab === "check" ? (
            <AttendanceCheck
              groupId={selectedGroupId}
              members={members}
              attendance={attendance}
              selectedDate={selectedDate}
            />
          ) : (
            <AttendanceHistory
              members={members}
              recentData={recentData}
              selectedDate={selectedDate}
              groupId={selectedGroupId}
            />
          )}
        </>
      )}
    </div>
  );
}

// ===== 출석 체크 탭 =====
function AttendanceCheck({
  groupId,
  members,
  attendance,
  selectedDate,
}: {
  groupId: number;
  members: Member[];
  attendance: AttendanceRecord[];
  selectedDate: string;
}) {
  const router = useRouter();

  // 기존 출석 데이터로 초기값 설정
  const initialStatuses: Record<number, AttendanceStatus | ""> = {};
  const initialPrayer: Record<number, boolean> = {};
  const initialPrayerNotes: Record<number, string> = {};

  members.forEach((m) => {
    const record = attendance.find((a) => a.member_id === m.id);
    initialStatuses[m.id] = record ? record.status : "";
    initialPrayer[m.id] = record ? record.prayer_request : false;
    initialPrayerNotes[m.id] = record?.prayer_note ?? "";
  });

  const [statuses, setStatuses] =
    useState<Record<number, AttendanceStatus | "">>(initialStatuses);
  const [prayerFlags, setPrayerFlags] = useState<Record<number, boolean>>(initialPrayer);
  const [prayerNotes, setPrayerNotes] = useState<Record<number, string>>(initialPrayerNotes);
  const [saving, setSaving] = useState(false);

  const handleStatusChange = (memberId: number, status: AttendanceStatus) => {
    setStatuses((prev) => ({
      ...prev,
      [memberId]: prev[memberId] === status ? "" : status,
    }));
  };

  const handlePrayerToggle = (memberId: number) => {
    setPrayerFlags((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
    // 기도필요 해제 시 노트 초기화
    if (prayerFlags[memberId]) {
      setPrayerNotes((prev) => ({ ...prev, [memberId]: "" }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const records = members
      .filter((m) => statuses[m.id] !== "")
      .map((m) => ({
        member_id: m.id,
        status: statuses[m.id] as AttendanceStatus,
        prayer_request: prayerFlags[m.id] ?? false,
        prayer_note: prayerFlags[m.id] ? prayerNotes[m.id] || null : null,
      }));

    if (records.length === 0) {
      alert("출석 체크된 멤버가 없습니다.");
      setSaving(false);
      return;
    }

    const result = await saveGroupAttendance(groupId, selectedDate, records);
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
  const presentCount = Object.values(statuses).filter((s) => s === "present").length;
  const absentCount = Object.values(statuses).filter((s) => s === "absent").length;

  return (
    <div className="mt-6">
      {/* 날짜 선택 */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) =>
            router.push(
              `/attendance?group=${groupId}&tab=check&date=${e.target.value}`
            )
          }
          className="rounded-lg border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] px-3.5 py-2.5 text-sm text-[var(--color-warm-text)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/10"
        />
        <span className="text-sm text-[var(--color-warm-muted)]">
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
        <span className="text-sm text-[var(--color-warm-muted)]">
          {checkedCount}/{members.length}명 체크 (출석 {presentCount}, 결석 {absentCount})
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => handleSelectAll("present")}
            className="rounded-lg px-2 py-1 text-xs text-[var(--color-warm-muted)] hover:bg-[var(--color-warm-bg)] hover:text-[var(--color-warm-text)] transition-all duration-300"
          >
            전체 출석
          </button>
          <button
            onClick={() => handleSelectAll("absent")}
            className="rounded-lg px-2 py-1 text-xs text-[var(--color-warm-muted)] hover:bg-[var(--color-warm-bg)] hover:text-[var(--color-warm-text)] transition-all duration-300"
          >
            전체 결석
          </button>
        </div>
      </div>

      {/* 멤버별 출석 체크 */}
      <div className="mt-4 space-y-2">
        {members.map((member) => (
          <div key={member.id} className="rounded-xl border border-[var(--color-warm-border)] bg-white shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium text-[var(--color-warm-text)]">
                {member.name}
              </span>
              <div className="flex items-center gap-2">
                {/* 출석/결석 버튼 */}
                <div className="flex gap-1.5">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleStatusChange(member.id, option.value)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
                        statuses[member.id] === option.value
                          ? option.color
                          : "bg-[var(--color-warm-bg)] text-[var(--color-warm-muted)] hover:bg-[var(--color-warm-border-light)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {/* 기도필요 토글 */}
                <button
                  onClick={() => handlePrayerToggle(member.id)}
                  className={`rounded-full px-2 py-1 text-xs transition-colors duration-200 ${
                    prayerFlags[member.id]
                      ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                      : "bg-[var(--color-warm-bg)] text-[var(--color-warm-muted)] hover:bg-amber-50/50"
                  }`}
                  title="기도필요"
                >
                  🙏
                </button>
              </div>
            </div>
            {/* 기도필요 사유 입력 (펼침) */}
            {prayerFlags[member.id] && (
              <div className="border-t px-4 py-2">
                <input
                  type="text"
                  value={prayerNotes[member.id] ?? ""}
                  onChange={(e) =>
                    setPrayerNotes((prev) => ({
                      ...prev,
                      [member.id]: e.target.value,
                    }))
                  }
                  placeholder="기도 사유를 간단히 입력하세요"
                  className="w-full rounded-lg border border-[var(--color-warm-border)] bg-[var(--color-warm-bg)] px-3 py-1.5 text-sm text-[var(--color-warm-text)] placeholder:text-[var(--color-warm-muted)] transition-all duration-300 focus:border-[var(--color-warm-text)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-text)]/10"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 저장 버튼 — 모든 역할에서 표시 */}
      <div className="mt-6 sticky bottom-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-[#1a1a1a] py-3 text-sm font-medium text-white shadow-[var(--shadow-elevated)] hover:bg-[#333] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300"
        >
          {saving ? "저장 중..." : "출석 저장"}
        </button>
      </div>
    </div>
  );
}

// ===== 출석 현황 탭 =====
function AttendanceHistory({
  members,
  recentData,
  selectedDate,
  groupId,
}: {
  members: Member[];
  recentData: { records: AttendanceRecord[]; dates: string[] };
  selectedDate: string;
  groupId: number;
}) {
  const router = useRouter();
  const { records, dates } = recentData;

  // 멤버별 최근 출석 데이터 매핑
  const memberAttendance = useMemo(() => {
    const result = members.map((member) => {
      const memberRecords = records.filter((r) => r.member_id === member.id);
      const weekData = dates.map((date) => {
        const record = memberRecords.find((r) => r.week_date === date);
        return record ?? null;
      });

      let consecutiveAbsent = 0;
      for (const rec of weekData) {
        if (!rec || rec.status === "absent") {
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
  const weeklyStats = useMemo(
    () =>
      dates.map((date) => {
        const weekRecords = records.filter((r) => r.week_date === date);
        const present = weekRecords.filter((r) => r.status === "present").length;
        return {
          date,
          total: weekRecords.length,
          present,
          rate:
            weekRecords.length > 0
              ? Math.round((present / weekRecords.length) * 100)
              : 0,
        };
      }),
    [records, dates]
  );

  // 기도필요 멤버 (가장 최근 날짜 기준)
  const prayerMembers = useMemo(() => {
    if (dates.length === 0) return [];
    const latestDate = dates[0]; // 가장 최근 날짜
    return records
      .filter((r) => r.week_date === latestDate && r.prayer_request)
      .map((r) => {
        const member = members.find((m) => m.id === r.member_id);
        return {
          name: member?.name ?? "알 수 없음",
          note: r.prayer_note,
        };
      });
  }, [records, dates, members]);

  const statusIcon = (record: AttendanceRecord | null) => {
    if (!record) return "—";
    const icon = record.status === "present" ? "●" : "○";
    return record.prayer_request ? `${icon}🙏` : icon;
  };

  const statusColor = (record: AttendanceRecord | null) => {
    if (!record) return "text-[var(--color-warm-subtle)]";
    switch (record.status) {
      case "present":
        return "text-green-500";
      case "absent":
        return "text-red-400";
      default:
        return "text-[var(--color-warm-subtle)]";
    }
  };

  return (
    <div className="mt-6">
      {/* 주간 출석률 */}
      {weeklyStats.length > 0 && (
        <div className="mb-6">
          <h3 className="text-[9px] font-medium text-[var(--color-warm-muted)] uppercase tracking-[0.25em]">주간 출석률</h3>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
            {weeklyStats.map((week) => (
              <div
                key={week.date}
                className="flex min-w-[80px] flex-col items-center rounded-xl border border-[var(--color-warm-border)] bg-white p-3 shadow-[var(--shadow-card)]"
              >
                <span className="text-xs text-[var(--color-warm-muted)]">
                  {new Date(week.date + "T00:00:00").toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="mt-1 text-lg font-bold text-[var(--color-warm-text)]">
                  {week.rate}%
                </span>
                <span className="text-xs text-[var(--color-warm-muted)]">
                  {week.present}/{week.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 기도필요 목록 */}
      {prayerMembers.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200/60 bg-amber-50/50 p-4">
          <h3 className="text-sm font-semibold text-amber-700">
            🙏 기도필요 ({prayerMembers.length}명)
          </h3>
          <div className="mt-2 space-y-1.5">
            {prayerMembers.map((pm, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span className="font-medium text-amber-800">{pm.name}</span>
                {pm.note && (
                  <span className="text-amber-600">— {pm.note}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 연속 결석 경고 */}
      {memberAttendance.filter((m) => m.consecutiveAbsent >= 3).length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200/60 bg-red-50/50 p-4">
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
        <p className="text-center text-[var(--color-warm-muted)]">출석 기록이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-warm-border)] text-[var(--color-warm-muted)]">
                <th className="sticky left-0 bg-[var(--color-warm-bg)] pb-3 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.2em]">
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
                  className={`border-b border-[var(--color-warm-border-light)] transition-colors duration-300 ${consecutiveAbsent >= 3 ? "bg-red-50/50" : "hover:bg-[var(--color-warm-bg)]"}`}
                >
                  <td className="sticky left-0 bg-inherit py-2.5 pr-4 font-medium text-[var(--color-warm-text)]">
                    {member.name}
                  </td>
                  {weekData.map((record, i) => (
                    <td
                      key={dates[i]}
                      className={`py-2.5 px-2 text-center ${statusColor(record)}`}
                    >
                      {statusIcon(record)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 범례 */}
      <div className="mt-4 flex gap-4 text-xs text-[var(--color-warm-muted)]">
        <span>
          <span className="text-green-500">●</span> 출석
        </span>
        <span>
          <span className="text-red-400">○</span> 결석
        </span>
        <span>
          <span className="text-[var(--color-warm-subtle)]">—</span> 미체크
        </span>
        <span>🙏 기도필요</span>
      </div>
    </div>
  );
}
