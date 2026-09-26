"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function CampaignQr({ slug }: { slug: string }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(`${window.location.origin}/group-apply/${slug}`, { width: 260, margin: 2 })
      .then(value => { if (alive) setImage(value); })
      .catch(() => { if (alive) setImage(""); });
    return () => { alive = false; };
  }, [slug]);
  if (!image) return <span className="text-xs text-[var(--color-warm-muted)]">QR 준비 중</span>;
  return <a href={image} download={`ium-group-${slug}.png`} className="inline-flex items-center gap-2 text-xs underline underline-offset-2">
    {/* QR data URL is generated locally from the public link. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={image} alt={`${slug} 순신청 QR 코드`} width={64} height={64} />
    QR 다운로드
  </a>;
}
