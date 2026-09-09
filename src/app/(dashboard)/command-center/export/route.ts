import { requireAuth } from "@/lib/auth";
import { todayInTimeZone } from "@/lib/command-center";

const EXPORT_TABLES = [
  "cc_seasons",
  "cc_ministries",
  "cc_occurrences",
  "cc_tasks",
  "cc_followups",
  "cc_decisions",
  "cc_resources",
  "cc_publications",
  "cc_person_refs",
  "cc_costs",
  "cc_inbox",
  "cc_templates",
  "cc_template_runs",
  "cc_occurrence_exceptions",
  "cc_weekly_reviews",
  "cc_change_log",
  "cc_decision_task_links",
  "cc_decision_occurrence_links",
  "cc_resource_task_links",
  "cc_resource_occurrence_links",
] as const;

export async function GET() {
  const { supabase, user, role } = await requireAuth();
  if (role !== "admin") {
    return Response.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const results = await Promise.all(
    EXPORT_TABLES.map(async (table) => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("owner_id", user.id);
      return { table, data: data ?? [], error };
    })
  );

  if (results.some((result) => result.error)) {
    return Response.json({ error: "내보내기를 만들지 못했습니다." }, { status: 500 });
  }

  const exportedAt = new Date().toISOString();
  const payload = Object.fromEntries(results.map((result) => [result.table, result.data]));
  const body = JSON.stringify({
    format: "ium-command-center-backup-v2",
    exported_at: exportedAt,
    timezone: "America/New_York",
    owner_id: user.id,
    ...payload,
  }, null, 2);

  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="ium-command-center-${todayInTimeZone()}.json"`,
      "cache-control": "no-store",
    },
  });
}
