import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export const applicationInput = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
  submissionKey: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  country: z.enum(["US", "KR", "OTHER"]),
  phone: z.string().trim().min(8).max(30),
  kind: z.enum(["new", "continuing", "change"]),
  note: z.string().max(500).default(""),
  consentVersion: z.number().int().positive(),
  consentAccepted: z.literal(true),
  website: z.string().max(100).optional(),
});

export type ApplicationInput = z.infer<typeof applicationInput>;

export function normalizePhone(value: string, country: "US" | "KR" | "OTHER"): string | null {
  const trimmed = value.trim();
  if (!/^[+\d\s().-]+$/.test(trimmed) || (country === "OTHER" && !trimmed.startsWith("+"))) return null;
  const parsed = parsePhoneNumberFromString(trimmed, country === "OTHER" ? undefined : country);
  return parsed?.isValid() ? parsed.number : null;
}

export function campaignOpen(campaign: { status: string; opens_at: string | null; closes_at: string | null }, now = Date.now()) {
  return campaign.status === "published" && !!campaign.opens_at && !!campaign.closes_at
    && Date.parse(campaign.opens_at) <= now && now < Date.parse(campaign.closes_at);
}

export type Campaign = {
  id: number;
  season_id: number;
  slug: string;
  title: string;
  intro: string;
  audience_description: string;
  audience_mode: "all" | "new_and_change";
  status: "draft" | "published" | "paused" | "archived";
  opens_at: string | null;
  closes_at: string | null;
  timezone: string;
  announcement_text: string;
  contact_text: string;
  notice_version: number;
  notice_text: string;
  retention_review_at: string | null;
  version: number;
};

export type RegistrationApplication = {
  id: number;
  campaign_id: number;
  season_id: number;
  name: string;
  phone: string | null;
  note: string | null;
  corrected_name: string | null;
  corrected_phone: string | null;
  corrected_note: string | null;
  application_kind: "new" | "continuing" | "change" | null;
  status: "pending" | "drafted" | "confirmed" | "cancelled" | "duplicate" | "legacy_review";
  match_status: "exact_candidate" | "review_required" | "new_candidate" | "new_prepared" | "linked" | null;
  match_reason: string | null;
  candidate_member_id: number | null;
  member_id: number | null;
  proposed_group_id: number | null;
  assigned_group_id: number | null;
  informed_at: string | null;
  version: number;
  applied_at: string;
};
