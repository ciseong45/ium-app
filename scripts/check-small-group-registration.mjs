// Run: node scripts/check-small-group-registration.mjs /path/to/@electric-sql/pglite/dist/index.js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) throw new Error("PGlite module path is required");
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('test.uid', true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, role text, linked_member_id int);
INSERT INTO public.profiles VALUES
 ('00000000-0000-0000-0000-000000000001','admin',NULL),
 ('00000000-0000-0000-0000-000000000002','group_leader',1);
CREATE TABLE public.members(id serial PRIMARY KEY, last_name text, first_name text, phone text, status text);
INSERT INTO public.members(last_name,first_name,phone,status) VALUES
  ('Lee','Ana','(415) 555-2671','active'), ('Kim','Bo','(415) 555-2672','active');
CREATE TABLE public.small_group_seasons(id serial PRIMARY KEY, name text, is_active boolean);
INSERT INTO public.small_group_seasons(name,is_active) VALUES('2026 Fall',true);
CREATE TABLE public.small_groups(id serial PRIMARY KEY, season_id int REFERENCES public.small_group_seasons(id), name text, leader_id int);
INSERT INTO public.small_groups(season_id,name) VALUES(1,'A순'),(1,'B순');
UPDATE public.small_groups SET leader_id=1 WHERE id=1;
CREATE TABLE public.small_group_members(id serial PRIMARY KEY, group_id int REFERENCES public.small_groups(id),
  member_id int REFERENCES public.members(id), created_at timestamptz DEFAULT now(), UNIQUE(group_id,member_id));
INSERT INTO public.small_group_members(group_id,member_id) VALUES(1,1);
ALTER TABLE public.small_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY small_group_members_auth_select ON public.small_group_members FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.small_group_members TO authenticated;
CREATE TABLE public.small_group_applications (
  id serial PRIMARY KEY, season_id int NOT NULL REFERENCES public.small_group_seasons(id),
  member_id int REFERENCES public.members(id), name text NOT NULL, phone text,
  source text NOT NULL DEFAULT 'form' CONSTRAINT small_group_applications_source_check CHECK(source IN ('form','admin')),
  status text NOT NULL DEFAULT 'pending' CONSTRAINT small_group_applications_status_check CHECK(status IN ('pending','assigned','cancelled')),
  assigned_group_id int REFERENCES public.small_groups(id), note text, applied_at timestamptz DEFAULT now()
);
ALTER TABLE public.small_group_applications ENABLE ROW LEVEL SECURITY;
INSERT INTO public.small_group_applications(season_id,member_id,name,phone,source,status,assigned_group_id)
 VALUES(1,1,'Lee Ana','(415) 555-2671','admin','assigned',1);
GRANT USAGE ON SCHEMA public, auth TO anon,authenticated,service_role;
GRANT SELECT,UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.small_groups TO authenticated;
SELECT set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
`);

await db.exec(await readFile(new URL("../supabase/20260922-small-group-registration.sql", import.meta.url), "utf8"));
const legacy = await db.query("SELECT status,source,legacy_snapshot->>'status' AS old_status FROM public.small_group_applications WHERE id=1");
assert.deepEqual(legacy.rows[0], { status: "legacy_review", source: "legacy", old_status: "assigned" });

await db.exec(`
INSERT INTO public.small_group_campaigns(season_id,slug,title,status,opens_at,closes_at,audience_description,announcement_text,contact_text,notice_text,retention_review_at)
VALUES(1,'fall-2026','Fall 순신청','published',now()-interval '1 day',now()+interval '1 day','전체 성도','배정 후 안내','담당자','안내','2027-01-01');
`);
async function apply(key, name, phone, hash = "a".repeat(64)) {
  return db.query(`SELECT public.receive_group_application('fall-2026',$1,$2,$3,'new','',1,$4,$5)`,
    [key, name, phone, hash, "c".repeat(64)]);
}
await apply("00000000-0000-4000-8000-000000000001", "Lee Ana", "+14155552671");
await apply("00000000-0000-4000-8000-000000000001", "Lee Ana", "+14155552671");
let rows = (await db.query("SELECT id,status,match_status,candidate_member_id FROM public.small_group_applications WHERE campaign_id=(SELECT id FROM public.small_group_campaigns WHERE slug='fall-2026') ORDER BY id")).rows;
assert.equal(rows.length, 1);
assert.equal(rows[0].match_status, "exact_candidate");
assert.equal(rows[0].candidate_member_id, 1);
await assert.rejects(apply("00000000-0000-4000-8000-000000000001", "Lee Ana", "+14155552671", "b".repeat(64)), /SUBMISSION_KEY_CONFLICT/);

await db.query("SELECT public.draft_group_application($1,1,2)", [rows[0].id]);
const campaignId = (await db.query("SELECT id FROM public.small_group_campaigns WHERE slug='fall-2026'")).rows[0].id;
const operationId = "00000000-0000-4000-8000-000000000011";
const items = JSON.stringify([{ id: rows[0].id, version: 2 }]);
const first = await db.query("SELECT public.confirm_group_applications($1,$2,$3::jsonb) AS result", [campaignId, operationId, items]);
const second = await db.query("SELECT public.confirm_group_applications($1,$2,$3::jsonb) AS result", [campaignId, operationId, items]);
assert.deepEqual(first.rows[0].result, second.rows[0].result);
const membership = await db.query("SELECT group_id,season_id FROM public.small_group_members WHERE member_id=1");
assert.equal(membership.rows.length, 1);
assert.equal(membership.rows[0].group_id, 2);
assert.equal(membership.rows[0].season_id, 1);
const confirmed = await db.query("SELECT status,member_id,assigned_group_id FROM public.small_group_applications WHERE id=$1", [rows[0].id]);
assert.deepEqual(confirmed.rows[0], { status: "confirmed", member_id: 1, assigned_group_id: 2 });

await apply("00000000-0000-4000-8000-000000000002", "Kim Bo", "+14155552672");
await apply("00000000-0000-4000-8000-000000000003", "Unknown Person", "+14155552673");
rows = (await db.query("SELECT id,match_status FROM public.small_group_applications WHERE campaign_id=$1 ORDER BY id", [campaignId])).rows;
assert.equal(rows[1].match_status, "exact_candidate");
assert.equal(rows[2].match_status, "new_candidate");
await db.query("SELECT public.draft_group_application($1,1,1)", [rows[1].id]);
await db.query("SELECT public.draft_group_application($1,1,1)", [rows[2].id]);
await assert.rejects(db.query("SELECT public.confirm_group_applications($1,$2,$3::jsonb)", [campaignId,
  "00000000-0000-4000-8000-000000000012", JSON.stringify([{ id: rows[1].id, version: 2 }, { id: rows[2].id, version: 2 }])]), /MATCH_REVIEW_REQUIRED/);
assert.equal((await db.query("SELECT count(*)::int AS n FROM public.small_group_members WHERE member_id=2")).rows[0].n, 0);
assert.equal((await db.query("SELECT status FROM public.small_group_applications WHERE id=$1", [rows[1].id])).rows[0].status, "drafted");
const beforeNew = (await db.query("SELECT count(*)::int AS n FROM public.members")).rows[0].n;
await db.query("SELECT public.prepare_new_group_member($1,2,'Unknown','Person','명단 검색 후 신규 확인')", [rows[2].id]);
assert.equal((await db.query("SELECT count(*)::int AS n FROM public.members")).rows[0].n, beforeNew);
await db.query("SELECT public.confirm_group_applications($1,$2,$3::jsonb)", [campaignId,
  "00000000-0000-4000-8000-000000000013", JSON.stringify([{ id: rows[2].id, version: 3 }])]);
assert.equal((await db.query("SELECT count(*)::int AS n FROM public.members")).rows[0].n, beforeNew + 1);
assert.equal((await db.query("SELECT status FROM public.small_group_applications WHERE id=$1", [rows[2].id])).rows[0].status, "confirmed");
await db.query("SELECT public.set_group_member(1,1,1,2,'명단 직접 이동')");
assert.equal((await db.query("SELECT group_id FROM public.small_group_members WHERE member_id=1")).rows[0].group_id, 1);
await assert.rejects(db.query("SELECT public.set_group_member(1,1,2,2,'오래된 화면에서 이동')"), /VERSION_CONFLICT/);
await assert.rejects(db.query("SELECT public.revoke_group_application($1,3,2,NULL,'배정 취소 확인')", [rows[0].id]), /ALREADY_CHANGED/);
await db.query("SELECT public.set_group_member(1,1,2,1,'명단 원위치')");
await db.query("SELECT public.revoke_group_application($1,3,2,1,'담당자 확인 후 기존 순으로 복귀')", [rows[0].id]);
assert.equal((await db.query("SELECT status FROM public.small_group_applications WHERE id=$1", [rows[0].id])).rows[0].status, "cancelled");
assert.equal((await db.query("SELECT group_id FROM public.small_group_members WHERE member_id=1")).rows[0].group_id, 1);
await db.query("SELECT public.set_group_members_bulk(1,ARRAY[1,2]::integer[],2,'성도 목록 일괄 배정')");
assert.equal((await db.query("SELECT count(*)::int AS n FROM public.small_group_members WHERE group_id=2")).rows[0].n, 2);
await assert.rejects(db.query("SELECT public.set_group_members_bulk(1,ARRAY[1,999]::integer[],1,'유효하지 않은 일괄 배정')"), /NOT_FOUND/);
assert.equal((await db.query("SELECT group_id FROM public.small_group_members WHERE member_id=1")).rows[0].group_id, 2);
await db.exec("INSERT INTO public.members(last_name,first_name,phone,status) VALUES('Park','Min','(415) 555-2674','active')");
await apply("00000000-0000-4000-8000-000000000004", "Park Mi", "+14155552674");
const correctionId = (await db.query("SELECT max(id) AS id FROM public.small_group_applications")).rows[0].id;
assert.equal((await db.query("SELECT match_status FROM public.small_group_applications WHERE id=$1", [correctionId])).rows[0].match_status, "review_required");
await db.query("SELECT public.correct_group_application($1,1,'Park Min','+14155552674','','신청 이름 오타 확인')", [correctionId]);
const corrected = (await db.query("SELECT name,corrected_name,match_status,candidate_member_id FROM public.small_group_applications WHERE id=$1", [correctionId])).rows[0];
assert.equal(corrected.name, "Park Mi");
assert.equal(corrected.corrected_name, "Park Min");
assert.equal(corrected.match_status, "exact_candidate");
assert.equal(corrected.candidate_member_id, 4);
await db.query("SELECT public.set_group_member(1,1,1,2,'순장 권한 범위 확인')");
await db.exec("SET ROLE authenticated");
const campaignVisible = await db.query("SELECT title FROM public.small_group_campaigns WHERE slug='fall-2026'");
assert.equal(campaignVisible.rows[0].title, "Fall 순신청");
await db.exec("SELECT set_config('test.uid','00000000-0000-0000-0000-000000000002',false)");
assert.equal((await db.query("SELECT count(*)::int AS n FROM public.small_group_applications")).rows[0].n, 0);
assert.equal((await db.query("SELECT count(*)::int AS n FROM public.small_group_members")).rows[0].n, 2);
await assert.rejects(db.query("SELECT public.draft_group_application($1,2,2)", [rows[1].id]), /FORBIDDEN/);
await assert.rejects(db.query("UPDATE public.profiles SET role='admin' WHERE id='00000000-0000-0000-0000-000000000002'"), /FORBIDDEN/);
await db.exec("SET ROLE anon");
const publicCampaign = await db.query("SELECT title,notice_text FROM public.small_group_campaigns WHERE slug='fall-2026'");
assert.equal(publicCampaign.rows.length, 1);
await assert.rejects(db.query("SELECT created_by FROM public.small_group_campaigns"), /permission denied/);
await assert.rejects(db.query("SELECT name FROM public.small_group_applications"), /permission denied/);
console.log("순신청 DB 검증 통과: 과거 이력, 중복 제출, 자동 대조, 이동, 신규 성도, 원자적 롤백, 공개 권한");
await db.close();
