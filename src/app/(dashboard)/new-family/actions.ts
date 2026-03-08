"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type NewFamilyEntry = {
  id: number;
  member_id: number;
  first_visit: string;
  step: number;
  step_updated_at: string;
  assigned_to: number | null;
  notes: string | null;
  created_at: string;
  member: { id: number; name: string; phone: string | null };
  assignee: { id: number; name: string } | null;
};

export async function getNewFamilies() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("new_family")
    .select(
      "*, member:members!member_id(id, name, phone), assignee:members!assigned_to(id, name)"
    )
    .order("step", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as NewFamilyEntry[];
}

export async function createNewFamily(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const phone = (formData.get("phone") as string) || null;
  const firstVisit = formData.get("first_visit") as string;
  const assignedTo = formData.get("assigned_to") as string;

  // 먼저 멤버 등록
  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({ name, phone, status: "active" })
    .select("id")
    .single();

  if (memberError) throw memberError;

  // 새가족 등록
  const { error } = await supabase.from("new_family").insert({
    member_id: member.id,
    first_visit: firstVisit,
    assigned_to: assignedTo ? Number(assignedTo) : null,
  });

  if (error) throw error;
  revalidatePath("/new-family");
  return { success: true };
}

export async function updateStep(id: number, step: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("new_family")
    .update({ step, step_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/new-family");
  return { success: true };
}

export async function updateAssignee(id: number, assignedTo: number | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("new_family")
    .update({ assigned_to: assignedTo })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/new-family");
  return { success: true };
}

export async function deleteNewFamily(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("new_family").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/new-family");
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
