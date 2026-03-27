"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { saveConti, deleteSheetMusic } from "./actions";
import type { ContiSongDraft } from "./actions";
import { createClient } from "@/lib/supabase/client";
import type {
  WorshipConti,
  ContiSong,
  ServiceType,
  WorshipLineupSlot,
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

type LineupSlotWithMember = WorshipLineupSlot & {
  member_last_name: string;
  member_first_name: string;
  position_name: string;
};

import Link from "next/link";

type Props = {
  conti: WorshipConti | null;
  songs: ContiSong[];
  members: Member[];
  selectedDate: string;
  serviceType: ServiceType;
  lineupSlots: LineupSlotWithMember[];
};

const KEYS = [
  "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B",
];

const TIME_SIGNATURES = ["4/4", "3/4", "6/8", "2/4"];

function makeSongDraft(s?: ContiSong): ContiSongDraft {
  return {
    title: s?.title || "",
    song_key: s?.song_key || null,
    notes: s?.notes || null,
    bpm: s?.bpm || null,
    time_signature: s?.time_signature || null,
    artist: s?.artist || null,
    reference_url: s?.reference_url || null,
    song_form: s?.song_form || null,
    session_notes: s?.session_notes || null,
    singer_notes: s?.singer_notes || null,
    engineer_notes: s?.engineer_notes || null,
    sheet_music_url: s?.sheet_music_url || null,
  };
}

export default function ContiView({
  conti,
  songs: initialSongs,
  members,
  selectedDate,
  serviceType,
  lineupSlots,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // 콘티 메타
  const [leaderId, setLeaderId] = useState<number | null>(conti?.leader_member_id || null);
  const [theme, setTheme] = useState(conti?.theme || "");
  const [notes, setNotes] = useState(conti?.notes || "");
  const [scripture, setScripture] = useState(conti?.scripture || "");
  const [description, setDescription] = useState(conti?.description || "");
  const [discussionQuestions, setDiscussionQuestions] = useState(conti?.discussion_questions || "");

  // 곡 리스트
  const [songList, setSongList] = useState<ContiSongDraft[]>(
    initialSongs.length > 0
      ? initialSongs.map((s) => makeSongDraft(s))
      : [makeSongDraft()]
  );

  // 곡별 열림/닫힘 상태
  const [openSongs, setOpenSongs] = useState<Set<number>>(new Set([0]));

  const toggleSong = (index: number) => {
    setOpenSongs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // 라인업 그룹핑
  const lineupByPosition = useMemo(() => {
    const map = new Map<string, string[]>();
    lineupSlots.forEach((slot) => {
      const names = map.get(slot.position_name) || [];
      names.push(`${slot.member_last_name}${slot.member_first_name}`);
      map.set(slot.position_name, names);
    });
    return map;
  }, [lineupSlots]);

  const handleDateChange = (date: string) => {
    router.push(`/worship/planning/conti/edit?date=${date}&type=${serviceType}`);
  };

  const handleTypeChange = (type: string) => {
    router.push(`/worship/planning/conti/edit?date=${selectedDate}&type=${type}`);
  };

  const addSong = () => {
    setSongList((prev) => [...prev, makeSongDraft()]);
    setOpenSongs((prev) => new Set([...prev, songList.length]));
  };

  const removeSong = (index: number) => {
    setSongList((prev) => prev.filter((_, i) => i !== index));
    setOpenSongs((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const updateSong = (index: number, field: keyof ContiSongDraft, value: string | number | null) => {
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

  const handleSheetUpload = async (index: number, file: File) => {
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const allowed = ["jpg", "jpeg", "png", "webp"];
      if (!allowed.includes(ext)) {
        alert("JPG, PNG, WEBP만 업로드 가능합니다.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("파일 크기는 5MB 이하만 가능합니다.");
        return;
      }

      const supabase = createClient();
      const fileName = `sheet-music/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("conti-assets")
        .upload(fileName, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        alert(`업로드 실패: ${uploadError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("conti-assets")
        .getPublicUrl(fileName);

      updateSong(index, "sheet_music_url", urlData.publicUrl);
    } catch (err) {
      alert(`업로드 중 오류: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSheetDelete = async (index: number) => {
    const url = songList[index].sheet_music_url;
    if (!url) return;
    const result = await deleteSheetMusic(url);
    if (result.success) {
      updateSong(index, "sheet_music_url", null);
    } else {
      alert(result.error || "악보 삭제에 실패했습니다.");
    }
  };

  const handleDownloadPdf = async () => {
    const { generateContiPdf } = await import("./generateContiPdf");
    const leaderName = leaderId
      ? (() => {
          const m = members.find((m) => m.id === leaderId);
          return m ? `${m.last_name}${m.first_name}` : "";
        })()
      : "";
    await generateContiPdf({
      date: selectedDate,
      serviceType,
      theme,
      scripture,
      description,
      discussionQuestions,
      leaderName,
      notes,
      songs: songList,
      lineupByPosition,
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
      scripture || null,
      description || null,
      discussionQuestions || null,
      validSongs
    );
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(false);
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6">
        <Link
          href="/worship/planning/conti"
          className="mb-3 inline-flex items-center gap-1 text-xs text-[var(--color-warm-muted)] transition-colors hover:text-[var(--color-warm-text)]"
        >
          ← 목록으로
        </Link>
        <div className="flex items-end justify-between">
          <div>
            <p className={SECTION_LABEL_CLASS}>Conti</p>
            <h1 className={PAGE_TITLE_CLASS}>
              {conti ? "콘티 수정" : "새 콘티 작성"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={serviceType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="rounded-lg border border-[var(--color-warm-border)] bg-white px-3 py-2 text-sm"
            >
              {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
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
      </div>

      <div className="space-y-6">
        {/* ── 1. 예배 정보 카드 ── */}
        <div className={`${CARD_CLASS} p-5`}>
          <p className={`${SECTION_LABEL_CLASS} mb-4`}>예배 정보</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-[var(--color-warm-secondary)]">인도자</label>
              <select
                value={leaderId || ""}
                onChange={(e) => setLeaderId(e.target.value ? Number(e.target.value) : null)}
                className={SELECT_CLASS}
              >
                <option value="">선택</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.last_name}{m.first_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-warm-secondary)]">주제</label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="예: 종려주일, 은혜..."
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-[var(--color-warm-secondary)]">본문</label>
              <input
                type="text"
                value={scripture}
                onChange={(e) => setScripture(e.target.value)}
                placeholder="예: 마태복음 21:9-11"
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-[var(--color-warm-secondary)]">주제 설명</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="이번 예배의 방향과 메시지..."
                rows={4}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        {/* ── 2. 라인업 (읽기전용) ── */}
        {lineupSlots.length > 0 && (
          <div className={`${CARD_CLASS} p-5`}>
            <p className={`${SECTION_LABEL_CLASS} mb-3`}>라인업</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              {Array.from(lineupByPosition.entries()).map(([position, names]) => (
                <div key={position} className="text-sm">
                  <span className="font-medium text-[var(--color-warm-text)]">{position}:</span>{" "}
                  <span className="text-[var(--color-warm-secondary)]">{names.join(", ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 3. 곡 목록 ── */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className={SECTION_LABEL_CLASS}>곡 목록 ({songList.length}곡)</p>
            <button
              onClick={addSong}
              className="text-xs text-[var(--color-warm-secondary)] hover:text-[var(--color-warm-text)] transition-colors"
            >
              + 곡 추가
            </button>
          </div>

          <div className="space-y-3">
            {songList.map((song, i) => (
              <SongCard
                key={i}
                index={i}
                song={song}
                isOpen={openSongs.has(i)}
                isFirst={i === 0}
                isLast={i === songList.length - 1}
                onToggle={() => toggleSong(i)}
                onUpdate={(field, value) => updateSong(i, field, value)}
                onMove={(dir) => moveSong(i, dir)}
                onRemove={() => removeSong(i)}
                onSheetUpload={(file) => handleSheetUpload(i, file)}
                onSheetDelete={() => handleSheetDelete(i)}
              />
            ))}
          </div>
        </div>

        {/* ── 4. 나눔 질문 ── */}
        <div className={`${CARD_CLASS} p-5`}>
          <p className={`${SECTION_LABEL_CLASS} mb-3`}>나눔 질문</p>
          <textarea
            value={discussionQuestions}
            onChange={(e) => setDiscussionQuestions(e.target.value)}
            placeholder="소그룹 나눔 질문을 작성하세요..."
            rows={5}
            className={INPUT_CLASS}
          />
        </div>

        {/* ── 5. 전체 메모 + 저장 ── */}
        <div className={`${CARD_CLASS} p-5`}>
          <p className={`${SECTION_LABEL_CLASS} mb-3`}>전체 메모</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="전체 메모..."
            rows={4}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${BTN_PRIMARY_CLASS} flex-1`}
          >
            {saving ? "저장 중..." : "콘티 저장"}
          </button>
          {conti && (
            <button
              onClick={handleDownloadPdf}
              className={`${BTN_SECONDARY_CLASS} shrink-0`}
            >
              PDF 다운로드
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 곡 카드 (접을 수 있는 형태) ──

function SongCard({
  index,
  song,
  isOpen,
  isFirst,
  isLast,
  onToggle,
  onUpdate,
  onMove,
  onRemove,
  onSheetUpload,
  onSheetDelete,
}: {
  index: number;
  song: ContiSongDraft;
  isOpen: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onUpdate: (field: keyof ContiSongDraft, value: string | number | null) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onSheetUpload: (file: File) => void;
  onSheetDelete: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  return (
    <div className={CARD_CLASS}>
      {/* 헤더 — 항상 표시 */}
      <div
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-3 px-5 py-4 transition-colors hover:bg-[var(--color-warm-bg)]"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-[11px] font-medium text-white">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={song.title}
            onChange={(e) => { e.stopPropagation(); onUpdate("title", e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            placeholder="곡명"
            className="w-full bg-transparent text-sm font-medium text-[var(--color-warm-text)] outline-none placeholder:text-[var(--color-warm-muted)]"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--color-warm-muted)]">
          {song.song_key && (
            <span className="rounded-full bg-[var(--color-warm-bg)] px-2 py-0.5 font-medium">
              {song.song_key}
            </span>
          )}
          {song.time_signature && <span>{song.time_signature}</span>}
          {song.bpm && <span>{song.bpm}bpm</span>}
          <span className="ml-1">{isOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* 상세 — 접을 수 있음 */}
      {isOpen && (
        <div className="border-t border-[var(--color-warm-border-light)] px-5 py-4">
          {/* 기본 정보 */}
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div>
              <label className="text-[10px] font-medium text-[var(--color-warm-muted)]">키</label>
              <select
                value={song.song_key || ""}
                onChange={(e) => onUpdate("song_key", e.target.value || null)}
                className="mt-1 w-full rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
              >
                <option value="">Key</option>
                {KEYS.map((k) => (<option key={k} value={k}>{k}</option>))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-[var(--color-warm-muted)]">박자</label>
              <select
                value={song.time_signature || ""}
                onChange={(e) => onUpdate("time_signature", e.target.value || null)}
                className="mt-1 w-full rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
              >
                <option value="">박자</option>
                {TIME_SIGNATURES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-[var(--color-warm-muted)]">BPM</label>
              <input
                type="number"
                value={song.bpm ?? ""}
                onChange={(e) => onUpdate("bpm", e.target.value ? Number(e.target.value) : null)}
                placeholder="BPM"
                className="mt-1 w-full rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[var(--color-warm-muted)]">아티스트</label>
              <input
                type="text"
                value={song.artist || ""}
                onChange={(e) => onUpdate("artist", e.target.value || null)}
                placeholder="아티스트/출처"
                className="mt-1 w-full rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* 참고 링크 */}
          <div className="mb-4">
            <label className="text-[10px] font-medium text-[var(--color-warm-muted)]">참고 링크</label>
            <input
              type="url"
              value={song.reference_url || ""}
              onChange={(e) => onUpdate("reference_url", e.target.value || null)}
              placeholder="https://youtu.be/..."
              className="mt-1 w-full rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
            />
          </div>

          {/* 송폼 */}
          <div className="mb-4">
            <label className="text-[10px] font-medium text-[var(--color-warm-muted)]">송폼</label>
            <input
              type="text"
              value={song.song_form || ""}
              onChange={(e) => onUpdate("song_form", e.target.value || null)}
              placeholder="예: Intro(4) - V - PC - 한마디 - V - PCx2 - Cx4 - Tagx2 - Outro(4)"
              className="mt-1 w-full rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
            />
          </div>

          {/* 악보 이미지 */}
          <div className="mb-4">
            <label className="text-[10px] font-medium text-[var(--color-warm-muted)]">악보</label>
            {song.sheet_music_url ? (
              <div className="mt-1 space-y-2">
                <div className="relative overflow-hidden rounded-lg border border-[var(--color-warm-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={song.sheet_music_url}
                    alt={`${song.title} 악보`}
                    className="w-full"
                  />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onSheetDelete(); }}
                  className="text-xs text-rose-400 hover:text-rose-600"
                >
                  악보 삭제
                </button>
              </div>
            ) : (
              <label className="mt-1 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-warm-border)] p-6 transition-colors hover:border-[var(--color-warm-muted)] hover:bg-[var(--color-warm-bg)]">
                <div className="text-center">
                  <p className="text-xs text-[var(--color-warm-muted)]">
                    {uploading ? "업로드 중..." : "클릭하여 악보 이미지 업로드"}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--color-warm-muted)]">
                    JPG, PNG, WEBP (최대 5MB)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    await onSheetUpload(file);
                    setUploading(false);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          {/* 세션/싱어/엔지니어 노트 */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-medium text-[var(--color-warm-muted)]">세션노트</label>
              <textarea
                value={song.session_notes || ""}
                onChange={(e) => onUpdate("session_notes", e.target.value || null)}
                placeholder="세션(밴드)을 위한 노트..."
                rows={3}
                className="mt-1 w-full rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[var(--color-warm-muted)]">싱어노트</label>
              <textarea
                value={song.singer_notes || ""}
                onChange={(e) => onUpdate("singer_notes", e.target.value || null)}
                placeholder="싱어를 위한 노트..."
                rows={3}
                className="mt-1 w-full rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[var(--color-warm-muted)]">엔지니어노트</label>
              <textarea
                value={song.engineer_notes || ""}
                onChange={(e) => onUpdate("engineer_notes", e.target.value || null)}
                placeholder="음향 엔지니어를 위한 노트..."
                rows={2}
                className="mt-1 w-full rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[var(--color-warm-muted)]">메모</label>
              <input
                type="text"
                value={song.notes || ""}
                onChange={(e) => onUpdate("notes", e.target.value || null)}
                placeholder="기타 메모"
                className="mt-1 w-full rounded-md border border-[var(--color-warm-border)] bg-white px-2 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* 하단 액션 */}
          <div className="mt-4 flex items-center justify-between border-t border-[var(--color-warm-border-light)] pt-3">
            <div className="flex gap-2">
              <button
                onClick={() => onMove(-1)}
                disabled={isFirst}
                className="rounded px-2 py-1 text-xs text-[var(--color-warm-muted)] hover:bg-[var(--color-warm-bg)] disabled:opacity-30"
              >
                ↑ 위로
              </button>
              <button
                onClick={() => onMove(1)}
                disabled={isLast}
                className="rounded px-2 py-1 text-xs text-[var(--color-warm-muted)] hover:bg-[var(--color-warm-bg)] disabled:opacity-30"
              >
                ↓ 아래로
              </button>
            </div>
            <button
              onClick={onRemove}
              className="rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-50 hover:text-rose-600"
            >
              곡 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
