"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createMember, updateMember } from "./actions";
import type { Member } from "@/types/member";

export default function MemberForm({ member }: { member?: Member }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!member;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    try {
      if (isEdit) {
        await updateMember(member.id, formData);
      } else {
        await createMember(formData);
      }
      router.push("/members");
      router.refresh();
    } catch {
      setError("저장에 실패했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      {/* 이름 (필수) */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          type="text"
          required
          defaultValue={member?.name}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 전화번호 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          전화번호
        </label>
        <input
          name="phone"
          type="tel"
          defaultValue={member?.phone || ""}
          placeholder="010-0000-0000"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 이메일 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          이메일
        </label>
        <input
          name="email"
          type="email"
          defaultValue={member?.email || ""}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 성별 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">성별</label>
        <select
          name="gender"
          defaultValue={member?.gender || ""}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">선택 안 함</option>
          <option value="M">남</option>
          <option value="F">여</option>
        </select>
      </div>

      {/* 생년월일 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          생년월일
        </label>
        <input
          name="birth_date"
          type="date"
          defaultValue={member?.birth_date || ""}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 주소 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">주소</label>
        <input
          name="address"
          type="text"
          defaultValue={member?.address || ""}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 상태 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">상태</label>
        <select
          name="status"
          defaultValue={member?.status || "active"}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="active">재적</option>
          <option value="attending">출석</option>
          <option value="inactive">미출석</option>
          <option value="removed">제적</option>
        </select>
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">메모</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={member?.notes || ""}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* 버튼 */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "저장 중..." : isEdit ? "수정" : "등록"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
      </div>
    </form>
  );
}
