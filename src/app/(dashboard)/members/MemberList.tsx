"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Member } from "@/types/member";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/member";

export default function MemberList({
  members,
  currentSearch,
  currentStatus,
}: {
  members: Member[];
  currentSearch?: string;
  currentStatus?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch || "");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (currentStatus && currentStatus !== "all")
      params.set("status", currentStatus);
    router.push(`/members?${params.toString()}`);
  };

  const handleStatusFilter = (status: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    router.push(`/members?${params.toString()}`);
  };

  return (
    <div className="mt-6">
      {/* 검색 + 필터 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호로 검색"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            검색
          </button>
        </form>

        <div className="flex gap-1">
          {[
            { value: "all", label: "전체" },
            { value: "active", label: "재적" },
            { value: "attending", label: "출석" },
            { value: "inactive", label: "미출석" },
            { value: "removed", label: "제적" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusFilter(option.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                (currentStatus || "all") === option.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 수 */}
      <p className="mt-4 text-sm text-gray-500">
        총 {members.length}명
      </p>

      {/* 멤버 테이블 */}
      {members.length === 0 ? (
        <div className="mt-8 text-center text-gray-400">
          {currentSearch || currentStatus
            ? "검색 결과가 없습니다."
            : "등록된 멤버가 없습니다."}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-3 pr-4 font-medium">이름</th>
                <th className="pb-3 pr-4 font-medium">전화번호</th>
                <th className="hidden pb-3 pr-4 font-medium sm:table-cell">
                  성별
                </th>
                <th className="pb-3 pr-4 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => router.push(`/members/${member.id}`)}
                  className="cursor-pointer border-b transition-colors hover:bg-gray-50"
                >
                  <td className="py-3 pr-4 font-medium text-gray-900">
                    {member.name}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {member.phone || "—"}
                  </td>
                  <td className="hidden py-3 pr-4 text-gray-600 sm:table-cell">
                    {member.gender === "M"
                      ? "남"
                      : member.gender === "F"
                        ? "여"
                        : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[member.status]}`}
                    >
                      {STATUS_LABELS[member.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
