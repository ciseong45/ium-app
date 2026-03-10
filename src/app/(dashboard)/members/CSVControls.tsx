"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  exportMembersCSV,
  importMembersCSV,
  downloadCSVTemplate,
} from "./actions";
import type { ImportRow } from "./actions";
import type { UserRole } from "@/lib/auth";

export default function CSVControls({ role }: { role: UserRole }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: ImportRow[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportMembersCSV();
      if (result.success) {
        const blob = new Blob([result.csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `멤버목록_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(result.error);
      }
    } catch {
      alert("내보내기에 실패했습니다.");
    }
    setExporting(false);
  };

  const handleTemplate = async () => {
    const csv = await downloadCSVTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "멤버_템플릿.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const text = await file.text();
      const result = await importMembersCSV(text);
      if (result.success) {
        setImportResult({ imported: result.imported, skipped: result.skipped });
        router.refresh();
      } else {
        setImportError(result.error);
      }
    } catch {
      setImportError("파일 읽기에 실패했습니다.");
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {exporting ? "내보내는 중..." : "CSV 내보내기"}
      </button>

      {role !== "group_leader" && (
        <button
          onClick={() => {
            setShowImportModal(true);
            setImportResult(null);
            setImportError(null);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          CSV 가져오기
        </button>
      )}

      {/* 가져오기 모달 */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              CSV 멤버 가져오기
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              CSV 파일에서 멤버를 대량 등록합니다. 기존 멤버와 중복 여부는
              확인하지 않으므로 주의하세요.
            </p>

            {/* 템플릿 다운로드 */}
            <button
              onClick={handleTemplate}
              className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              템플릿 CSV 다운로드
            </button>

            {/* CSV 형식 안내 */}
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-700">CSV 열 형식:</p>
              <p className="mt-1 text-xs text-gray-500">
                이름, 전화번호, 이메일, 성별(남/여), 생년월일(YYYY-MM-DD), 주소, 상태(재적/출석/미출석/제적/휴적), 메모
              </p>
            </div>

            {/* 파일 선택 */}
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                disabled={importing}
                className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50 disabled:opacity-50"
              />
            </div>

            {/* 진행 중 */}
            {importing && (
              <p className="mt-3 text-sm text-blue-600">가져오는 중...</p>
            )}

            {/* 에러 */}
            {importError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {importError}
              </div>
            )}

            {/* 결과 */}
            {importResult && (
              <div className="mt-3 space-y-2">
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                  {importResult.imported}명을 성공적으로 등록했습니다.
                </div>
                {importResult.skipped.length > 0 && (
                  <div className="rounded-lg bg-yellow-50 p-3">
                    <p className="text-sm font-medium text-yellow-700">
                      건너뛴 행 ({importResult.skipped.length}건):
                    </p>
                    <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs text-yellow-600">
                      {importResult.skipped.map((s, i) => (
                        <li key={i}>
                          {s.row}행: {s.name} — {s.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 닫기 */}
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowImportModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
