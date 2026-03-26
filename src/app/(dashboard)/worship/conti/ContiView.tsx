"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveConti, searchSongs } from "./actions";
import type {
  WorshipConti,
  ContiSong,
  ServiceType,
  Song,
} from "@/types/worship";
import { SERVICE_TYPE_LABELS } from "@/types/worship";
import type { Member } from "@/types/member";
import {
  CARD_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_LABEL_CLASS,
  BTN_PRIMARY_CLASS,
  BTN_SECONDARY_CLASS,
  INPUT_CLASS,
  SELECT_CLASS,
} from "@/components/ui/constants";

type SongDraft = {
  title: string;
  song_key: string | null;
  notes: string | null;
};

type Props = {
  conti: WorshipConti | null;
  songs: ContiSong[];
  members: Member[];
  recentContis: WorshipConti[];
  selectedDate: string;
  serviceType: ServiceType;
};

const KEYS = [
  "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B",
];

export default function ContiView({
  conti,
  songs: initialSongs,
  members,
  recentContis,
  selectedDate,
  serviceType,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [leaderId, setLeaderId] = useState<number | null>(
    conti?.leader_member_id || null
  );
  const [theme, setTheme] = useState(conti?.theme || "");
  const [notes, setNotes] = useState(conti?.notes || "");
  const [songList, setSongList] = useState<SongDraft[]>(
    initialSongs.length > 0
      ? initialSongs.map((s) => ({
          title: s.title,
          song_key: s.song_key,
          notes: s.notes,
        }))
      : [{ title: "", song_key: null, notes: null }]
  );

  const handleDateChange = (date: string) => {
    router.push(`/worship/conti?date=${date}&type=${serviceType}`);
  };

  const handleTypeChange = (type: string) => {
    router.push(`/worship/conti?date=${selectedDate}&type=${type}`);
  };

  const addSong = () => {
    setSongList((prev) => [...prev, { title: "", song_key: null, notes: null }]);
  };

  const removeSong = (index: number) => {
    setSongList((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSong = (index: number, field: keyof SongDraft, value: string | null) => {
    setSongList((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const moveSong = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= songList.length) return;
    setSongList((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    const validSongs = songList.filter((s) => s.title.trim());
    if (validSongs.length === 0) {
      alert("최소 1곡을 입력해주세요.");
      return;
    }

    setSaving(true);
    const result = await saveConti(
      selectedDate,
      serviceType,
      leaderId,
      theme || null,
      notes || null,
      validSongs
    );
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className={SECTION_LABEL_CLASS}>Conti</p>
          <h1 className={PAGE_TITLE_CLASS}>예배 콘티</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={serviceType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="rounded-lg border border-[var(--color-warm-border)] bg-white px-3 py-2 text-sm"
          >
            {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-lg border border-[var(--color-warm-border)] bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* 최근 콘티 */}
      {recentContis.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {recentContis.map((c) => (
            <button
              key={`${c.service_date}-${c.service_type}`}
              onClick={() =>
                router.push(
                  `/worship/conti?date=${c.service_date}&type=${c.service_type}`
                )
              }
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-all ${
                c.service_date === selectedDate &&
                c.service_type === serviceType
                  ? "bg-[#1a1a1a] text-white"
                  : "bg-[var(--color-warm-bg)] text-[var(--color-warm-secondary)] hover:bg-[var(--color-warm-border)]"
              }`}
            >
              {formatDate(c.service_date)}{" "}
              {c.service_type !== "주일" && c.service_type}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* 메인: 콘티 편집 */}
        <div className="space-y-4">
          {/* 메타 */}
          <div className={`${CARD_CLASS} p-5`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-[var(--color-warm-secondary)]">
                  인도자
                </label>
                <select
                  value={leaderId || ""}
                  onChange={(e) =>
                    setLeaderId(e.target.value ? Number(e.target.value) : null)
                  }
                  className={SELECT_CLASS}
                >
                  <option value="">선택</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.last_name}{m.first_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-warm-secondary)]">
                  콘티 주제
                </label>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="예: 은혜, 위대하신 하나님..."
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* 곡 목록 */}
          <div className={`${CARD_CLASS} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--color-warm-text)]">
                곡 목록
              </p>
              <button
                onClick={addSong}
                className="text-xs text-[var(--color-warm-secondary)] hover:text-[var(--color-warm-text)]"
              >
                + 곡 추가
              </button>
            </div>

            <div className="space-y-3">
              {songList.map((song, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-[var(--color-warm-bg)] p-3"
                >
                  <span className="mt-2.5 text-xs font-medium text-[var(--color-warm-muted)]">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={song.title}
                      onChange={(e) => updateSong(i, "title", e.target.value)}
                      placeholder="곡명"
                      className="w-full rounded-md border border-[var(--color-warm-border)] bg-white px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <select
                        value={song.song_key || ""}
                        onChange={(e) =>
                          updateSong(i, "song_key", e.target.value || null)
                        }
                        className="w-20 rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="">Key</option>
                        {KEYS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={song.notes || ""}
                        onChange={(e) =>
                          updateSong(i, "notes", e.target.value || null)
                        }
                        placeholder="메모"
                        className="flex-1 rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveSong(i, -1)}
                      disabled={i === 0}
                      className="text-xs text-[var(--color-warm-muted)] hover:text-[var(--color-warm-text)] disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveSong(i, 1)}
                      disabled={i === songList.length - 1}
                      className="text-xs text-[var(--color-warm-muted)] hover:text-[var(--color-warm-text)] disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeSong(i)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 사이드: 메모 + 저장 */}
        <div className="space-y-4">
          <div className={`${CARD_CLASS} p-4`}>
            <p className={`${SECTION_LABEL_CLASS} mb-2`}>Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="전체 메모..."
              rows={6}
              className={INPUT_CLASS}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`${BTN_PRIMARY_CLASS} w-full`}
          >
            {saving ? "저장 중..." : "콘티 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
