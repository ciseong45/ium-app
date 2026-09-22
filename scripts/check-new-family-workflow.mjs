// Run: node scripts/check-new-family-workflow.mjs /path/to/@electric-sql/pglite/dist/index.js
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('test.uid', true),'')::uuid $$;
CREATE TABLE profiles(id uuid PRIMARY KEY, role text);
INSERT INTO profiles VALUES ('00000000-0000-0000-0000-000000000001','admin'), ('00000000-0000-0000-0000-000000000002','group_leader');
CREATE TABLE members(id serial PRIMARY KEY, last_name text, first_name text, phone text, status text CONSTRAINT members_status_check CHECK(status IN ('active','attending','new_family','adjusting')), gender text, birth_date date, kakao_id text, is_baptized boolean, school_or_work text, notes text);
CREATE TABLE small_group_seasons(id serial PRIMARY KEY, is_active boolean, start_date date, end_date date);
CREATE TABLE upper_rooms(id bigserial PRIMARY KEY, season_id integer REFERENCES small_group_seasons(id), name text);
CREATE TABLE small_groups(id serial PRIMARY KEY, season_id integer REFERENCES small_group_seasons(id), upper_room_id bigint NOT NULL REFERENCES upper_rooms(id), name text);
CREATE TABLE small_group_members(group_id integer REFERENCES small_groups(id), member_id integer REFERENCES members(id), UNIQUE(group_id,member_id));
CREATE TABLE new_family(id serial PRIMARY KEY, member_id integer REFERENCES members(id), first_visit date, assigned_to integer REFERENCES members(id), season_id integer REFERENCES small_group_seasons(id), step integer NOT NULL DEFAULT 1 CHECK(step BETWEEN 1 AND 3), step_updated_at timestamptz DEFAULT now(), dropped_out boolean DEFAULT false, dropped_out_at timestamptz);
CREATE TABLE member_status_log(member_id integer, old_status text, new_status text, changed_by uuid, changed_at timestamptz DEFAULT now());
INSERT INTO small_group_seasons(is_active) VALUES(true);
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT SELECT ON profiles, member_status_log TO authenticated;
GRANT SELECT, UPDATE ON members, new_family TO authenticated;
`);
await db.exec(
  await readFile(
    new URL("../supabase/20260919-new-family-workflow.sql", import.meta.url),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/20260922-new-family-education-weeks.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/20260922-new-family-simple-education.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/20260922-new-family-reset-education.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
await db.exec(
  `SET ROLE anon; SELECT receive_new_family('{"last_name":"김","first_name":"방문"}'); RESET ROLE;`,
);
assert.equal(await scalar("SELECT status FROM members WHERE id=1"), "visitor");
assert.equal(
  await scalar(
    "SELECT count(*)::int FROM small_group_members WHERE member_id=1",
  ),
  1,
);
assert.equal(
  await scalar("SELECT count(*)::int FROM new_family WHERE member_id=1"),
  1,
);
await db.exec(
  `SET test.uid='00000000-0000-0000-0000-000000000001'; SET ROLE authenticated;`,
);
await assert.rejects(
  db.exec(`SELECT new_family_manage(1,'register');`),
  /교육 이수/,
);
await assert.rejects(
  db.exec(`UPDATE members SET status='active' WHERE id=1;`),
  /정식 등록/,
);
await assert.rejects(
  db.exec(
    `UPDATE new_family SET registered_at=now(), registered_by=auth.uid(), registration_source='confirmed' WHERE id=1;`,
  ),
  /정식 등록/,
);
await db.exec(
  `INSERT INTO new_family_courses(season_id,name,starts_on) VALUES(1,'1차','2026-09-20');`,
);
await assert.rejects(
  db.exec(`SELECT new_family_set_progress(1,1,4,false);`),
  /주차/,
);
await assert.rejects(
  db.exec(`SELECT new_family_set_progress(1,1,3,true);`),
  /마지막 주차/,
);
await db.exec(`SELECT new_family_set_progress(1,1,2,false);`);
assert.equal(
  await scalar(
    "SELECT current_week FROM new_family_enrollments WHERE family_id=1",
  ),
  2,
);
await assert.rejects(
  db.exec(`SELECT new_family_set_progress(1,1,2,true);`),
  /마지막 주차/,
);
await db.exec(`SELECT new_family_set_progress(1,1,3,false);`);
assert.equal(await scalar("SELECT step FROM new_family WHERE id=1"), 2);
assert.equal(await scalar("SELECT status FROM members WHERE id=1"), "visitor");
await db.exec(`SELECT new_family_set_progress(1,1,3,true);`);
await assert.rejects(
  db.exec(`SELECT new_family_set_progress(1,1,1,false);`),
  /수료/,
);
assert.equal(await scalar("SELECT status FROM members WHERE id=1"), "visitor");
assert.equal(
  await scalar("SELECT registered_at FROM new_family WHERE id=1"),
  null,
);
// 간편 변경은 개설 없이 수료 가능하며 등록 상태는 바꾸지 않는다.
await db.exec(`SELECT new_family_set_simple_education(1,1);`);
assert.equal(
  await scalar("SELECT education_progress FROM new_family WHERE id=1"),
  1,
);
assert.equal(await scalar("SELECT step FROM new_family WHERE id=1"), 2);
await assert.rejects(
  db.exec(`SELECT new_family_manage(1,'register');`),
  /교육 이수/,
);
await db.exec(`SELECT new_family_set_simple_education(1,0);`);
assert.equal(
  await scalar("SELECT education_progress FROM new_family WHERE id=1"),
  0,
);
assert.equal(await scalar("SELECT step FROM new_family WHERE id=1"), 1);
await assert.rejects(
  db.exec(`SELECT new_family_manage(1,'register');`),
  /교육 이수/,
);
await db.exec(`SELECT new_family_set_simple_education(1,4);`);
assert.equal(
  await scalar("SELECT registered_at FROM new_family WHERE id=1"),
  null,
);
assert.equal(await scalar("SELECT status FROM members WHERE id=1"), "visitor");
await assert.rejects(
  db.exec(`SELECT new_family_set_simple_education(1,5);`),
  /주차/,
);
await db.exec(
  `SELECT new_family_manage(1,'register'); SELECT new_family_manage(1,'register');`,
);
assert.equal(await scalar("SELECT status FROM members WHERE id=1"), "active");
assert.equal(
  await scalar("SELECT registered_by::text FROM new_family WHERE id=1"),
  "00000000-0000-0000-0000-000000000001",
);
assert.equal(await scalar("SELECT count(*)::int FROM member_status_log"), 1);
await assert.rejects(
  db.exec(`SELECT new_family_manage(1,'education',1,'scheduled');`),
  /등록 완료/,
);
await db.exec(
  `RESET ROLE; UPDATE new_family SET dropped_out=true, dropped_out_at=now() WHERE id=1; SET ROLE authenticated; SELECT new_family_manage(1,'restore');`,
);
assert.equal(await scalar("SELECT step FROM new_family WHERE id=1"), 3);
assert.equal(
  await scalar("SELECT registration_source FROM new_family WHERE id=1"),
  "confirmed",
);
await assert.rejects(
  db.exec(`SELECT new_family_set_simple_education(1,2);`),
  /정식 등록/,
);
await db.exec(`SET test.uid='00000000-0000-0000-0000-000000000002';`);
await assert.rejects(
  db.exec(`SELECT new_family_set_progress(1,1,1,false);`),
  /권한/,
);
await assert.rejects(
  db.exec(`SELECT new_family_manage(1,'register');`),
  /권한/,
);
await assert.rejects(
  db.exec(`SELECT new_family_set_simple_education(1,2);`),
  /권한/,
);
await db.exec(
  `RESET ROLE; UPDATE small_group_seasons SET is_active=false; SET test.uid=''; SET ROLE anon;`,
);
await assert.rejects(
  db.exec(
    `SELECT receive_new_family('{"last_name":"박","first_name":"누락"}');`,
  ),
  /활성 학기/,
);
await db.exec(`RESET ROLE;`);
assert.equal(await scalar("SELECT count(*)::int FROM members"), 1);
console.log(
  "PASS: migration, visitor group assignment, education separation, confirmation guard, audit/idempotency, role denial, restore preservation, atomic intake failure",
);
await db.close();
