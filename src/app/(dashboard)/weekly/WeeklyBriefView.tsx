"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createWeeklyBrief,
  updateBriefMeta,
  updateBriefTabContent,
} from "./actions";
import type { WeeklyBrief, BriefTabKey } from "@/types/weekly";
import { BRIEF_TABS, BRIEF_STATUS_LABELS, BRIEF_STATUS_COLORS } from "@/types/weekly";
import FilterPill from "@/components/ui/FilterPill";
import EmptyState from "@/components/ui/EmptyState";
import {
  CARD_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_LABEL_CLASS,
  BTN_PRIMARY_CLASS,
  BTN_SECONDARY_CLASS,
  INPUT_CLASS,
} from "@/components/ui/constants";

type Props = {
  brief: WeeklyBrief | null;
  recentBriefs: WeeklyBrief[];
  selectedDate: string;
};

export default function WeeklyBriefView({
  brief,
  recentBriefs,
  selectedDate,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<BriefTabKey>("common");
  const [saving, setSaving] = useState(false);

  // 생성 폼 상태
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [sermonTitle, setSermonTitle] = useState("");
  const [sermonScripture, setSermonScripture] = useState("");

  // 탭 콘텐츠 편집
  const [tabText, setTabText] = useState("");

  const handleDateChange = (date: string) => {
    router.push(`/weekly?date=${date}`);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const handleCreate = async () => {
    setSaving(true);
    const result = await createWeeklyBrief(
      selectedDate,
      title || null,
      sermonTitle || null,
      sermonScripture || null
    );
    if (result.success) {
      setShowCreate(false);
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(false);
  };

  const handleTabContentSave = async () => {
    if (!brief) return;
    setSaving(true);

    const content = { text: tabText };
    const result = await updateBriefTabContent(selectedDate, activeTab, content);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(false);
  };

  const getTabContent = (tabKey: BriefTabKey): string => {
    if (!brief) return "";
    const contentMap: Record<BriefTabKey, Record<string, unknown>> = {
      common: brief.common_content,
      worship: brief.worship_content,
      media: brief.media_content,
      newfamily: brief.newfamily_content,
      smallgroup: brief.smallgroup_content,
    };
    const content = contentMap[tabKey];
    return (content?.text as string) || "";
  };

  const handleTabChange = (key: BriefTabKey) => {
    setActiveTab(key);
    setTabText(getTabContent(key));
  };

  // 탭 변경 시 콘텐츠 로드
  if (brief && tabText === "" && getTabContent(activeTab)) {
    setTabText(getTabContent(activeTab));
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className={SECTION_LABEL_CLASS}>Weekly Brief</p>
          <h1 className={PAGE_TITLE_CLASS}>주간 사역자료</h1>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="rounded-lg border border-[var(--color-warm-border)] bg-white px-3 py-2 text-sm"
        />
      </div>

      {/* 최근 자료 */}
      {recentBriefs.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {recentBriefs.map((b) => (
            <button
              key={b.week_date}
              onClick={() => handleDateChange(b.week_date)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-all ${
                b.week_date === selectedDate
                  ? "bg-[#1a1a1a] text-white"
                  : "bg-[var(--color-warm-bg)] text-[var(--color-warm-secondary)] hover:bg-[var(--color-warm-border)]"
              }`}
            >
              {formatDate(b.week_date)}
              {b.status === "draft" && " ·"}
            </button>
          ))}
        </div>
      )}

      {!brief ? (
        /* 자료 없을 때 */
        <div className="text-center">
          <EmptyState message={`${selectedDate} 주간 자료가 없습니다.`} />
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className={BTN_PRIMARY_CLASS}
            >
              새 주간 자료 만들기
            </button>
          ) : (
            <div className={`${CARD_CLASS} mx-auto max-w-md p-6 text-left`}>
              <p className="mb-4 text-sm font-medium">새 주간 자료</p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="자료 제목 (예: 13주차 사역팀 자료)"
                  className={INPUT_CLASS}
                />
                <input
                  type="text"
                  value={sermonTitle}
                  onChange={(e) => setSermonTitle(e.target.value)}
                  placeholder="설교 제목"
                  className={INPUT_CLASS}
                />
                <input
                  type="text"
                  value={sermonScripture}
                  onChange={(e) => setSermonScripture(e.target.value)}
                  placeholder="설교 본문 (예: 요한복음 20:24-29)"
                  className={INPUT_CLASS}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    className={BTN_PRIMARY_CLASS}
                  >
                    {saving ? "생성 중..." : "생성"}
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className={BTN_SECONDARY_CLASS}
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 자료 있을 때 */
        <div>
          {/* 헤더 정보 */}
          <div className={`${CARD_CLASS} mb-6 p-5`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-warm-text)]">
                  {brief.title || `${formatDate(brief.week_date)} 주간 자료`}
                </h2>
                {brief.sermon_title && (
                  <p className="mt-1 text-sm text-[var(--color-warm-secondary)]">
                    설교: {brief.sermon_title}
                  </p>
                )}
                {brief.sermon_scripture && (
                  <p className="text-sm text-[var(--color-warm-muted)]">
                    {brief.sermon_scripture}
                  </p>
                )}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  BRIEF_STATUS_COLORS[brief.status]
                }`}
              >
                {BRIEF_STATUS_LABELS[brief.status]}
              </span>
            </div>
          </div>

          {/* 탭 */}
          <div className="mb-6 flex gap-1 border-b border-[var(--color-warm-border)]">
            {BRIEF_TABS.map((tab) => (
              <FilterPill
                key={tab.key}
                label={tab.label}
                active={activeTab === tab.key}
                onClick={() => handleTabChange(tab.key)}
              />
            ))}
          </div>

          {/* 탭 콘텐츠 편집 */}
          <div className={`${CARD_CLASS} p-5`}>
            <textarea
              value={tabText}
              onChange={(e) => setTabText(e.target.value)}
              placeholder={`${BRIEF_TABS.find((t) => t.key === activeTab)?.label} 내용을 입력하세요...`}
              rows={12}
              className={`${INPUT_CLASS} font-mono text-xs`}
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleTabContentSave}
                disabled={saving}
                className={BTN_PRIMARY_CLASS}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
