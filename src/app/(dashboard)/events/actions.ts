"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validations";
import type { ChurchEvent } from "@/types/event";

export async function getEvents(): Promise<ChurchEvent[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) return [];
  return data as ChurchEvent[];
}

export async function getUpcomingEvents(count: number = 5): Promise<ChurchEvent[]> {
  const { supabase } = await requireAuth();
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("start_date", today)
    .order("start_date")
    .limit(count);
  if (error) return [];
  return data as ChurchEvent[];
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const name = (formData.get("name") as string)?.trim();
  const eventType = formData.get("event_type") as string;
  const startDate = formData.get("start_date") as string;
  const endDate = (formData.get("end_date") as string) || null;
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name || !startDate)
    return { success: false, error: "이름과 시작일을 입력해주세요." };

  const { error } = await supabase.from("events").insert({
    name,
    event_type: eventType,
    start_date: startDate,
    end_date: endDate,
    description,
  });

  if (error) return { success: false, error: "행사 등록에 실패했습니다." };
  revalidatePath("/events");
  return { success: true };
}

export async function updateEvent(id: number, formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role === "group_leader")
    return { success: false, error: "권한이 없습니다." };

  const name = (formData.get("name") as string)?.trim();
  const eventType = formData.get("event_type") as string;
  const startDate = formData.get("start_date") as string;
  const endDate = (formData.get("end_date") as string) || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  const { error } = await supabase
    .from("events")
    .update({
      name,
      event_type: eventType,
      start_date: startDate,
      end_date: endDate,
      description,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, error: "수정에 실패했습니다." };
  revalidatePath("/events");
  return { success: true };
}

export async function deleteEvent(id: number): Promise<ActionResult> {
  const { supabase, role } = await requireAuth();
  if (role !== "admin")
    return { success: false, error: "권한이 없습니다." };

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { success: false, error: "삭제에 실패했습니다." };
  revalidatePath("/events");
  return { success: true };
}
