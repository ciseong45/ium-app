"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type OneToOneStatus = "active" | "completed" | "paused";

export type OneToOneEntry = {
  id: number;
  mentor: { id: number; name: string };
  mentee: { id: number; name: string };
  status: OneToOneStatus;
  started_at: string;
  completed_at: string | null;
};

export type SessionEntry = {
  id: number;
  one_to_one_id: number;
  session_date: string;
  session_number: number;
  notes: string | null;
};

export async function getOneToOnes(status?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("one_to_one")
    .select(
      "*, mentor:members!mentor_id(id, name), mentee:members!mentee_id(id, name)"
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as OneToOneEntry[];
}

export async function createOneToOne(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("one_to_one").insert({
    mentor_id: Number(formData.get("mentor_id")),
    mentee_id: Number(formData.get("mentee_id")),
    started_at: (formData.get("started_at") as string) || new Date().toISOString().split("T")[0],
  });
  if (error) throw error;
  revalidatePath("/one-to-one");
  return { success: true };
}

export async function updateOneToOneStatus(id: number, status: OneToOneStatus) {
  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };
  if (status === "completed") {
    updates.completed_at = new Date().toISOString().split("T")[0];
  }
  const { error } = await supabase
    .from("one_to_one")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/one-to-one");
  return { success: true };
}

export async function deleteOneToOne(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("one_to_one").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/one-to-one");
  return { success: true };
}

export async function getSessions(oneToOneId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("one_to_one_sessions")
    .select("*")
    .eq("one_to_one_id", oneToOneId)
    .order("session_number", { ascending: true });
  if (error) throw error;
  return data as SessionEntry[];
}

export async function addSession(oneToOneId: number, formData: FormData) {
  const supabase = await createClient();

  // 다음 회차 번호 계산
  const { data: existing } = await supabase
    .from("one_to_one_sessions")
    .select("session_number")
    .eq("one_to_one_id", oneToOneId)
    .order("session_number", { ascending: false })
    .limit(1);

  const nextNumber = existing && existing.length > 0 ? existing[0].session_number + 1 : 1;

  const { error } = await supabase.from("one_to_one_sessions").insert({
    one_to_one_id: oneToOneId,
    session_date:
      (formData.get("session_date") as string) ||
      new Date().toISOString().split("T")[0],
    session_number: nextNumber,
    notes: (formData.get("notes") as string) || null,
  });

  if (error) throw error;
  revalidatePath("/one-to-one");
  return { success: true };
}

export async function deleteSession(sessionId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("one_to_one_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
  revalidatePath("/one-to-one");
  return { success: true };
}

export async function getActiveMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, name")
    .in("status", ["active", "attending"])
    .order("name");
  if (error) throw error;
  return data;
}
