"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addSong, updateSong, deleteSong } from "./actions";
import type { Song } from "@/types/worship";
import EmptyState from "@/components/ui/EmptyState";
import {
  CARD_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_LABEL_CLASS,
  TABLE_HEADER_CLASS,
  TABLE_ROW_CLASS,
  BTN_PRIMARY_CLASS,
  BTN_SECONDARY_CLASS,
  INPUT_CLASS,
  SELECT_CLASS,
} from "@/components/ui/constants";

const KEYS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];

type SongWithUsage = Song & { usage_count: number };

type Props = {
  songs: SongWithUsage[];
  searchQuery: string;
};

export default function SongLibraryView({ songs, searchQuery }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(searchQuery);
  const [showForm, setShowForm] = useState(false);
  const [editingSong, setEditingSong] = useState<SongWithUsage | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    defaultKey: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleSearch = () => {
    router.push(search ? `/worship/planning/songs?q=${encodeURIComponent(search)}` : "/worship/planning/songs");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const openAddForm = () => {
    setEditingSong(null);
    setFormData({ title: "", artist: "", defaultKey: "" });
    setShowForm(true);
  };

  const openEditForm = (song: SongWithUsage) => {
    setEditingSong(song);
    setFormData({
      title: song.title,
      artist: song.artist || "",
      defaultKey: song.default_key || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;
    setSaving(true);

    const result = editingSong
      ? await updateSong(
          editingSong.id,
          formData.title.trim(),
          formData.artist.trim() || null,
          formData.defaultKey || null
        )
      : await addSong(
          formData.title.trim(),
          formData.artist.trim() || null,
          formData.defaultKey || null
        );

    if (result.success) {
      setShowForm(false);
      setEditingSong(null);
      router.refresh();
    } else {
      alert(result.error);
    }
    setSaving(false);
  };

  const handleDelete = async (songId: number) => {
    if (!confirm("곡을 삭제하시겠습니까?")) return;
    setDeleting(songId);
    const result = await deleteSong(songId);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setDeleting(null);
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className={SECTION_LABEL_CLASS}>Song Library</p>
          <h1 className={PAGE_TITLE_CLASS}>곡 라이브러리</h1>
        </div>
        <p className="text-sm text-[var(--color-warm-secondary)]">
          {songs.length}곡
        </p>
      </div>

      {/* 검색 + 추가 */}
      <div className="mb-6 flex gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="곡 제목 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className={INPUT_CLASS}
          />
        </div>
        <button onClick={handleSearch} className={BTN_SECONDARY_CLASS}>
          검색
        </button>
        <button onClick={openAddForm} className={BTN_PRIMARY_CLASS}>
          곡 추가
        </button>
      </div>

      {/* 곡 목록 */}
      {songs.length === 0 ? (
        <EmptyState message={searchQuery ? "검색 결과가 없습니다." : "등록된 곡이 없습니다."} />
      ) : (
        <div className={`${CARD_CLASS} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_HEADER_CLASS}>
                <th className="px-4 py-3 text-left">제목</th>
                <th className="px-3 py-3 text-left">아티스트</th>
                <th className="px-3 py-3 text-center">키</th>
                <th className="px-3 py-3 text-center">사용</th>
                <th className="px-3 py-3 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => (
                <tr key={song.id} className={TABLE_ROW_CLASS}>
                  <td className="px-4 py-3 font-medium text-[var(--color-warm-text)]">
                    {song.title}
                  </td>
                  <td className="px-3 py-3 text-[var(--color-warm-secondary)]">
                    {song.artist || "—"}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {song.default_key ? (
                      <span className="inline-block rounded-full bg-[var(--color-warm-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-warm-text)]">
                        {song.default_key}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-[var(--color-warm-secondary)]">
                    {song.usage_count > 0 ? (
                      <span className="text-xs">{song.usage_count}회</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditForm(song)}
                        className="text-xs text-[var(--color-warm-muted)] transition-colors hover:text-[var(--color-warm-text)]"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => handleDelete(song.id)}
                        disabled={deleting === song.id}
                        className="text-xs text-[var(--color-warm-muted)] transition-colors hover:text-rose-500"
                      >
                        {deleting === song.id ? "..." : "삭제"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 추가/편집 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className={`${CARD_CLASS} w-full max-w-md p-6`}>
            <p className={`${SECTION_LABEL_CLASS} mb-2`}>
              {editingSong ? "곡 편집" : "곡 추가"}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--color-warm-muted)]">제목 *</label>
                <input
                  type="text"
                  placeholder="곡 제목"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="text-xs text-[var(--color-warm-muted)]">아티스트</label>
                <input
                  type="text"
                  placeholder="아티스트 (선택)"
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="text-xs text-[var(--color-warm-muted)]">기본 키</label>
                <select
                  value={formData.defaultKey}
                  onChange={(e) => setFormData({ ...formData, defaultKey: e.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">키 선택 (선택)</option>
                  {KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => { setShowForm(false); setEditingSong(null); }}
                className={BTN_SECONDARY_CLASS}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !formData.title.trim()}
                className={BTN_PRIMARY_CLASS}
              >
                {saving ? "저장 중..." : editingSong ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
