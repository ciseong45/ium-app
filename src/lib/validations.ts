import { z } from "zod";

export const memberSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다.").max(50, "이름이 너무 깁니다."),
  phone: z.string().max(20).nullable(),
  email: z.string().email("올바른 이메일 형식이 아닙니다.").nullable(),
  gender: z.enum(["M", "F"]).nullable(),
  birth_date: z.string().nullable(),
  address: z.string().max(200).nullable(),
  status: z.enum(["active", "attending", "inactive", "removed", "on_leave"]).default("active"),
  kakao_id: z.string().max(50).nullable(),
  is_baptized: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  school_or_work: z.string().max(100).nullable(),
  notes: z.string().max(1000).nullable(),
});

export const visitorCardSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다.").max(50),
  phone: z.string().max(20).nullable(),
  kakao_id: z.string().max(50).nullable(),
  gender: z.enum(["M", "F"]).nullable(),
  birth_date: z.string().nullable(),
  baptism: z.string().nullable(),
  school_work: z.string().max(100).nullable(),
  previous_church: z.string().max(100).nullable(),
});

export const seasonSchema = z.object({
  name: z.string().min(1, "시즌 이름은 필수입니다.").max(50),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  is_active: z.boolean().default(false),
});

export const groupSchema = z.object({
  name: z.string().min(1, "그룹 이름은 필수입니다.").max(50),
  leader_id: z.number().nullable(),
});

export const oneToOneSchema = z.object({
  mentor_id: z.number({ error: "멘토를 선택해주세요." }),
  mentee_id: z.number({ error: "멘티를 선택해주세요." }),
  started_at: z.string(),
}).refine((data) => data.mentor_id !== data.mentee_id, {
  message: "멘토와 멘티는 다른 사람이어야 합니다.",
});

export type ActionResult =
  | { success: true; warning?: string }
  | { success: false; error: string };

export function parseFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData
): z.infer<T> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    const str = value as string;
    raw[key] = str === "" ? null : str;
  }
  return schema.parse(raw);
}
