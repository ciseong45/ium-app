"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createMember, updateMember } from "./actions";
import type { Member } from "@/types/member";
import { INPUT_CLASS } from "@/components/ui/constants";

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
      const result = isEdit
        ? await updateMember(member.id, formData)
        : await createMember(formData);

      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
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
      {/* 성 + 이름 (필수) */}
      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <div>
          <label className="block text-sm font-medium text-[var(--color-warm-text)]">
            성 <span className="text-red-500">*</span>
          </label>
          <input
            name="last_name"
            type="text"
            required
            defaultValue={member?.last_name}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-warm-text)]">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            name="first_name"
            type="text"
            required
            defaultValue={member?.first_name}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {/* 전화번호 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-text)]">
          전화번호
        </label>
        <input
          name="phone"
          type="tel"
          defaultValue={member?.phone || ""}
          placeholder="010-0000-0000"
          className={INPUT_CLASS}
        />
      </div>

      {/* 이메일 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-text)]">
          이메일
        </label>
        <input
          name="email"
          type="email"
          defaultValue={member?.email || ""}
          className={INPUT_CLASS}
        />
      </div>

      {/* 카카오톡 ID */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-text)]">
          카카오톡 ID
        </label>
        <input
          name="kakao_id"
          type="text"
          defaultValue={member?.kakao_id || ""}
          className={INPUT_CLASS}
        />
      </div>

      {/* 성별 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-text)]">성별</label>
        <select
          name="gender"
          defaultValue={member?.gender || ""}
          className={INPUT_CLASS}
        >
          <option value="">선택 안 함</option>
          <option value="M">남</option>
          <option value="F">여</option>
        </select>
      </div>

      {/* 생년월일 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-text)]">
          생년월일
        </label>
        <input
          name="birth_date"
          type="date"
          defaultValue={member?.birth_date || ""}
          className={INPUT_CLASS}
        />
      </div>

      {/* 학교/직장 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-text)]">
          학교/직장
        </label>
        <input
          name="school_or_work"
          type="text"
          defaultValue={member?.school_or_work || ""}
          className={INPUT_CLASS}
        />
      </div>

      {/* 세례입교 여부 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-text)]">
          세례입교 여부
        </label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="is_baptized"
              value="true"
              defaultChecked={member?.is_baptized === true}
              className="text-[#1a1a1a] accent-[#1a1a1a]"
            />
            <span className="text-sm text-[var(--color-warm-text)]">예</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="is_baptized"
              value="false"
              defaultChecked={!member?.is_baptized}
              className="text-[#1a1a1a] accent-[#1a1a1a]"
            />
            <span className="text-sm text-[var(--color-warm-text)]">아니오</span>
          </label>
        </div>
      </div>

      {/* 주소 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-text)]">주소</label>
        <input
          name="address"
          type="text"
          defaultValue={member?.address || ""}
          className={INPUT_CLASS}
        />
      </div>

      {/* 상태 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-text)]">상태</label>
        <select
          name="status"
          defaultValue={member?.status || "active"}
          className={INPUT_CLASS}
        >
          <option value="active">재적</option>
          <option value="attending">출석</option>
          <option value="new_family">새가족</option>
          <option value="adjusting">적응중</option>
          <option value="on_leave">휴적</option>
          <option value="inactive">미출석</option>
          <option value="removed">제적</option>
        </select>
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-warm-text)]">메모</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={member?.notes || ""}
          className={INPUT_CLASS}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* 버튼 */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#333] disabled:opacity-40 disabled:pointer-events-none"
        >
          {loading ? "저장 중..." : isEdit ? "수정" : "등록"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-[var(--color-warm-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--color-warm-text)] transition-all duration-300 hover:border-[var(--color-warm-text)] hover:bg-[var(--color-warm-bg)]"
        >
          취소
        </button>
      </div>
    </form>
  );
}
