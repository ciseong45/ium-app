import jsPDF from "jspdf";
import type { ContiSongDraft } from "./actions";
import type { ServiceType } from "@/types/worship";
import { SERVICE_TYPE_LABELS } from "@/types/worship";

type ContiPdfInput = {
  date: string;
  serviceType: ServiceType;
  theme: string;
  scripture: string;
  description: string;
  discussionQuestions: string;
  leaderName: string;
  notes: string;
  songs: ContiSongDraft[];
  lineupByPosition: Map<string, string[]>;
};

// A4: 210 x 297mm
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function generateContiPdf(input: ContiPdfInput) {
  // Dynamic import html2canvas to avoid SSR issues
  const html2canvas = (await import("html2canvas")).default;

  // Create hidden container for rendering
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0;
    width: 800px; background: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1a1a1a; padding: 40px; line-height: 1.6;
  `;
  document.body.appendChild(container);

  const pdf = new jsPDF("p", "mm", "a4");

  try {
    // ── Page 1: 예배 정보 ──
    const dateObj = new Date(input.date + "T00:00:00");
    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    const serviceLabel = SERVICE_TYPE_LABELS[input.serviceType];

    container.innerHTML = buildInfoPageHtml(dateStr, serviceLabel, input);
    const canvas1 = await html2canvas(container, { scale: 2, useCORS: true });
    addCanvasToPdf(pdf, canvas1);

    // ── Song pages ──
    for (let i = 0; i < input.songs.length; i++) {
      const song = input.songs[i];
      if (!song.title.trim()) continue;

      // Song info page
      container.innerHTML = buildSongPageHtml(i + 1, song);
      const songCanvas = await html2canvas(container, { scale: 2, useCORS: true });
      pdf.addPage();
      addCanvasToPdf(pdf, songCanvas);

      // Sheet music image (separate page)
      if (song.sheet_music_url) {
        try {
          const img = await loadImage(song.sheet_music_url);
          pdf.addPage();
          const imgRatio = img.width / img.height;
          let imgW = CONTENT_W;
          let imgH = imgW / imgRatio;
          if (imgH > PAGE_H - MARGIN * 2) {
            imgH = PAGE_H - MARGIN * 2;
            imgW = imgH * imgRatio;
          }
          const x = (PAGE_W - imgW) / 2;
          pdf.addImage(img, "JPEG", x, MARGIN, imgW, imgH);
        } catch {
          // Skip if image fails to load
        }
      }
    }

    // ── Discussion questions page (if exists) ──
    if (input.discussionQuestions?.trim()) {
      container.innerHTML = buildDiscussionPageHtml(input.discussionQuestions);
      const discCanvas = await html2canvas(container, { scale: 2, useCORS: true });
      pdf.addPage();
      addCanvasToPdf(pdf, discCanvas);
    }

    // Save
    const fileName = `${input.date}_${serviceLabel}_콘티.pdf`;
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement) {
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const ratio = canvas.width / canvas.height;
  let w = CONTENT_W;
  let h = w / ratio;
  if (h > PAGE_H - MARGIN * 2) {
    h = PAGE_H - MARGIN * 2;
    w = h * ratio;
  }
  const x = (PAGE_W - w) / 2;
  pdf.addImage(imgData, "JPEG", x, MARGIN, w, h);
}

function buildInfoPageHtml(
  dateStr: string,
  serviceLabel: string,
  input: ContiPdfInput
): string {
  const lineupHtml = Array.from(input.lineupByPosition.entries())
    .map(
      ([pos, names]) =>
        `<div style="margin-bottom:4px;"><strong>${pos}:</strong> ${names.join(", ")}</div>`
    )
    .join("");

  const songListHtml = input.songs
    .filter((s) => s.title.trim())
    .map((s, i) => {
      const meta = [s.song_key, s.time_signature, s.bpm ? `${s.bpm}bpm` : ""]
        .filter(Boolean)
        .join("; ");
      return `<div style="margin-bottom:2px;">${i + 1}. ${s.title}${meta ? ` (${meta})` : ""}</div>`;
    })
    .join("");

  return `
    <h1 style="font-size:28px; font-weight:bold; margin-bottom:8px;">
      ${dateStr} ${serviceLabel} 콘티
    </h1>
    ${input.theme ? `<h2 style="font-size:20px; color:#555; margin-bottom:16px;">주제: ${esc(input.theme)}</h2>` : ""}
    ${input.scripture ? `<div style="margin-bottom:16px;"><strong>본문:</strong> ${esc(input.scripture)}</div>` : ""}
    ${input.description ? `<div style="margin-bottom:24px; white-space:pre-wrap; color:#333;">${esc(input.description)}</div>` : ""}
    ${lineupHtml ? `<div style="margin-bottom:24px;"><h3 style="font-size:16px; font-weight:bold; margin-bottom:8px;">라인업</h3>${lineupHtml}</div>` : ""}
    ${songListHtml ? `<div style="margin-bottom:24px;"><h3 style="font-size:16px; font-weight:bold; margin-bottom:8px;">곡 목록</h3>${songListHtml}</div>` : ""}
    ${input.notes ? `<div style="margin-top:16px; color:#666; white-space:pre-wrap; font-size:13px;">${esc(input.notes)}</div>` : ""}
  `;
}

function buildSongPageHtml(num: number, song: ContiSongDraft): string {
  const meta = [song.song_key, song.time_signature, song.bpm ? `${song.bpm}bpm` : ""]
    .filter(Boolean)
    .join("; ");

  const sections = [
    { label: "아티스트", value: song.artist },
    { label: "송폼", value: song.song_form },
    { label: "세션노트", value: song.session_notes },
    { label: "싱어노트", value: song.singer_notes },
    { label: "엔지니어노트", value: song.engineer_notes },
    { label: "메모", value: song.notes },
  ];

  const sectionsHtml = sections
    .filter((s) => s.value)
    .map(
      (s) => `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px; font-weight:bold; color:#888; margin-bottom:4px;">${s.label}</div>
        <div style="white-space:pre-wrap; font-size:14px;">${esc(s.value!)}</div>
      </div>
    `
    )
    .join("");

  const refHtml = song.reference_url
    ? `<div style="margin-bottom:16px; font-size:13px; color:#0066cc; word-break:break-all;">${esc(song.reference_url)}</div>`
    : "";

  return `
    <h2 style="font-size:22px; font-weight:bold; margin-bottom:4px;">
      ${num}. ${esc(song.title)}${meta ? ` <span style="color:#888; font-weight:normal; font-size:16px;">(${meta})</span>` : ""}
    </h2>
    ${refHtml}
    ${sectionsHtml}
  `;
}

function buildDiscussionPageHtml(questions: string): string {
  return `
    <h2 style="font-size:22px; font-weight:bold; margin-bottom:16px;">나눔 질문</h2>
    <div style="white-space:pre-wrap; font-size:15px; line-height:1.8;">${esc(questions)}</div>
  `;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
