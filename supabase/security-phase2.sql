-- Phase 2: RLS 정책 전면 교체
-- 원칙:
--   SELECT: 모든 인증 사용자 허용
--   INSERT/UPDATE: admin + upper_room_leader
--   DELETE: admin만
--
-- ⚠️ 중요: 코드 배포 성공 확인 후 SQL 실행할 것
-- auth 스키마 우회: JWT claim에서 직접 user id 추출
-- (current_setting('request.jwt.claims',true)::json->>'sub')::uuid = auth.uid() 동일

-- ============================================================
-- members
-- ============================================================
DROP POLICY IF EXISTS "members_select" ON members;
DROP POLICY IF EXISTS "members_insert" ON members;
DROP POLICY IF EXISTS "members_update" ON members;
DROP POLICY IF EXISTS "members_delete" ON members;
DROP POLICY IF EXISTS "members_auth_select" ON members;
DROP POLICY IF EXISTS "members_auth_insert" ON members;
DROP POLICY IF EXISTS "members_auth_update" ON members;
DROP POLICY IF EXISTS "members_auth_delete" ON members;

CREATE POLICY "members_auth_select" ON members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_auth_insert" ON members
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "members_auth_update" ON members
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "members_auth_delete" ON members
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');

-- ============================================================
-- small_group_seasons
-- ============================================================
DROP POLICY IF EXISTS "small_group_seasons_select" ON small_group_seasons;
DROP POLICY IF EXISTS "small_group_seasons_insert" ON small_group_seasons;
DROP POLICY IF EXISTS "small_group_seasons_update" ON small_group_seasons;
DROP POLICY IF EXISTS "small_group_seasons_delete" ON small_group_seasons;
DROP POLICY IF EXISTS "small_group_seasons_auth_select" ON small_group_seasons;
DROP POLICY IF EXISTS "small_group_seasons_auth_insert" ON small_group_seasons;
DROP POLICY IF EXISTS "small_group_seasons_auth_update" ON small_group_seasons;
DROP POLICY IF EXISTS "small_group_seasons_auth_delete" ON small_group_seasons;

CREATE POLICY "small_group_seasons_auth_select" ON small_group_seasons
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "small_group_seasons_auth_insert" ON small_group_seasons
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');
CREATE POLICY "small_group_seasons_auth_update" ON small_group_seasons
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');
CREATE POLICY "small_group_seasons_auth_delete" ON small_group_seasons
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');

-- ============================================================
-- small_groups
-- ============================================================
DROP POLICY IF EXISTS "small_groups_select" ON small_groups;
DROP POLICY IF EXISTS "small_groups_insert" ON small_groups;
DROP POLICY IF EXISTS "small_groups_update" ON small_groups;
DROP POLICY IF EXISTS "small_groups_delete" ON small_groups;
DROP POLICY IF EXISTS "small_groups_auth_select" ON small_groups;
DROP POLICY IF EXISTS "small_groups_auth_insert" ON small_groups;
DROP POLICY IF EXISTS "small_groups_auth_update" ON small_groups;
DROP POLICY IF EXISTS "small_groups_auth_delete" ON small_groups;

CREATE POLICY "small_groups_auth_select" ON small_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "small_groups_auth_insert" ON small_groups
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');
CREATE POLICY "small_groups_auth_update" ON small_groups
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');
CREATE POLICY "small_groups_auth_delete" ON small_groups
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');

-- ============================================================
-- small_group_members
-- ============================================================
DROP POLICY IF EXISTS "small_group_members_select" ON small_group_members;
DROP POLICY IF EXISTS "small_group_members_insert" ON small_group_members;
DROP POLICY IF EXISTS "small_group_members_update" ON small_group_members;
DROP POLICY IF EXISTS "small_group_members_delete" ON small_group_members;
DROP POLICY IF EXISTS "small_group_members_auth_select" ON small_group_members;
DROP POLICY IF EXISTS "small_group_members_auth_insert" ON small_group_members;
DROP POLICY IF EXISTS "small_group_members_auth_update" ON small_group_members;
DROP POLICY IF EXISTS "small_group_members_auth_delete" ON small_group_members;

CREATE POLICY "small_group_members_auth_select" ON small_group_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "small_group_members_auth_insert" ON small_group_members
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "small_group_members_auth_update" ON small_group_members
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "small_group_members_auth_delete" ON small_group_members
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));

-- ============================================================
-- attendance
-- ============================================================
DROP POLICY IF EXISTS "attendance_select" ON attendance;
DROP POLICY IF EXISTS "attendance_insert" ON attendance;
DROP POLICY IF EXISTS "attendance_update" ON attendance;
DROP POLICY IF EXISTS "attendance_delete" ON attendance;
DROP POLICY IF EXISTS "attendance_auth_select" ON attendance;
DROP POLICY IF EXISTS "attendance_auth_insert" ON attendance;
DROP POLICY IF EXISTS "attendance_auth_update" ON attendance;
DROP POLICY IF EXISTS "attendance_auth_delete" ON attendance;

CREATE POLICY "attendance_auth_select" ON attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_auth_insert" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "attendance_auth_update" ON attendance
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "attendance_auth_delete" ON attendance
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');

-- ============================================================
-- new_family
-- ============================================================
DROP POLICY IF EXISTS "new_family_select" ON new_family;
DROP POLICY IF EXISTS "new_family_insert" ON new_family;
DROP POLICY IF EXISTS "new_family_update" ON new_family;
DROP POLICY IF EXISTS "new_family_delete" ON new_family;
DROP POLICY IF EXISTS "new_family_auth_select" ON new_family;
DROP POLICY IF EXISTS "new_family_auth_insert" ON new_family;
DROP POLICY IF EXISTS "new_family_auth_update" ON new_family;
DROP POLICY IF EXISTS "new_family_auth_delete" ON new_family;

CREATE POLICY "new_family_auth_select" ON new_family
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "new_family_auth_insert" ON new_family
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "new_family_auth_update" ON new_family
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "new_family_auth_delete" ON new_family
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');

-- ============================================================
-- one_to_one
-- ============================================================
DROP POLICY IF EXISTS "one_to_one_select" ON one_to_one;
DROP POLICY IF EXISTS "one_to_one_insert" ON one_to_one;
DROP POLICY IF EXISTS "one_to_one_update" ON one_to_one;
DROP POLICY IF EXISTS "one_to_one_delete" ON one_to_one;
DROP POLICY IF EXISTS "one_to_one_auth_select" ON one_to_one;
DROP POLICY IF EXISTS "one_to_one_auth_insert" ON one_to_one;
DROP POLICY IF EXISTS "one_to_one_auth_update" ON one_to_one;
DROP POLICY IF EXISTS "one_to_one_auth_delete" ON one_to_one;

CREATE POLICY "one_to_one_auth_select" ON one_to_one
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "one_to_one_auth_insert" ON one_to_one
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "one_to_one_auth_update" ON one_to_one
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "one_to_one_auth_delete" ON one_to_one
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');

-- ============================================================
-- one_to_one_sessions
-- ============================================================
DROP POLICY IF EXISTS "one_to_one_sessions_select" ON one_to_one_sessions;
DROP POLICY IF EXISTS "one_to_one_sessions_insert" ON one_to_one_sessions;
DROP POLICY IF EXISTS "one_to_one_sessions_update" ON one_to_one_sessions;
DROP POLICY IF EXISTS "one_to_one_sessions_delete" ON one_to_one_sessions;
DROP POLICY IF EXISTS "one_to_one_sessions_auth_select" ON one_to_one_sessions;
DROP POLICY IF EXISTS "one_to_one_sessions_auth_insert" ON one_to_one_sessions;
DROP POLICY IF EXISTS "one_to_one_sessions_auth_update" ON one_to_one_sessions;
DROP POLICY IF EXISTS "one_to_one_sessions_auth_delete" ON one_to_one_sessions;

CREATE POLICY "one_to_one_sessions_auth_select" ON one_to_one_sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "one_to_one_sessions_auth_insert" ON one_to_one_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "one_to_one_sessions_auth_update" ON one_to_one_sessions
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "one_to_one_sessions_auth_delete" ON one_to_one_sessions
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');

-- ============================================================
-- upper_rooms
-- ============================================================
DROP POLICY IF EXISTS "upper_rooms_select" ON upper_rooms;
DROP POLICY IF EXISTS "upper_rooms_insert" ON upper_rooms;
DROP POLICY IF EXISTS "upper_rooms_update" ON upper_rooms;
DROP POLICY IF EXISTS "upper_rooms_delete" ON upper_rooms;
DROP POLICY IF EXISTS "upper_rooms_auth_select" ON upper_rooms;
DROP POLICY IF EXISTS "upper_rooms_auth_insert" ON upper_rooms;
DROP POLICY IF EXISTS "upper_rooms_auth_update" ON upper_rooms;
DROP POLICY IF EXISTS "upper_rooms_auth_delete" ON upper_rooms;

CREATE POLICY "upper_rooms_auth_select" ON upper_rooms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "upper_rooms_auth_insert" ON upper_rooms
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');
CREATE POLICY "upper_rooms_auth_update" ON upper_rooms
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');
CREATE POLICY "upper_rooms_auth_delete" ON upper_rooms
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');

-- ============================================================
-- member_status_log
-- ============================================================
DROP POLICY IF EXISTS "member_status_log_select" ON member_status_log;
DROP POLICY IF EXISTS "member_status_log_insert" ON member_status_log;
DROP POLICY IF EXISTS "member_status_log_auth_select" ON member_status_log;
DROP POLICY IF EXISTS "member_status_log_auth_insert" ON member_status_log;

CREATE POLICY "member_status_log_auth_select" ON member_status_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "member_status_log_auth_insert" ON member_status_log
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));

-- ============================================================
-- member_leaves
-- ============================================================
DROP POLICY IF EXISTS "member_leaves_select" ON member_leaves;
DROP POLICY IF EXISTS "member_leaves_insert" ON member_leaves;
DROP POLICY IF EXISTS "member_leaves_update" ON member_leaves;
DROP POLICY IF EXISTS "member_leaves_delete" ON member_leaves;
DROP POLICY IF EXISTS "member_leaves_auth_select" ON member_leaves;
DROP POLICY IF EXISTS "member_leaves_auth_insert" ON member_leaves;
DROP POLICY IF EXISTS "member_leaves_auth_update" ON member_leaves;
DROP POLICY IF EXISTS "member_leaves_auth_delete" ON member_leaves;

CREATE POLICY "member_leaves_auth_select" ON member_leaves
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "member_leaves_auth_insert" ON member_leaves
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "member_leaves_auth_update" ON member_leaves
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "member_leaves_auth_delete" ON member_leaves
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) = 'admin');

-- ============================================================
-- member_ministry_teams
-- ============================================================
DROP POLICY IF EXISTS "member_ministry_teams_select" ON member_ministry_teams;
DROP POLICY IF EXISTS "member_ministry_teams_insert" ON member_ministry_teams;
DROP POLICY IF EXISTS "member_ministry_teams_update" ON member_ministry_teams;
DROP POLICY IF EXISTS "member_ministry_teams_delete" ON member_ministry_teams;
DROP POLICY IF EXISTS "member_ministry_teams_auth_select" ON member_ministry_teams;
DROP POLICY IF EXISTS "member_ministry_teams_auth_insert" ON member_ministry_teams;
DROP POLICY IF EXISTS "member_ministry_teams_auth_update" ON member_ministry_teams;
DROP POLICY IF EXISTS "member_ministry_teams_auth_delete" ON member_ministry_teams;

CREATE POLICY "member_ministry_teams_auth_select" ON member_ministry_teams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "member_ministry_teams_auth_insert" ON member_ministry_teams
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "member_ministry_teams_auth_update" ON member_ministry_teams
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
CREATE POLICY "member_ministry_teams_auth_delete" ON member_ministry_teams
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = ((current_setting('request.jwt.claims',true)::json->>'sub')::uuid)) IN ('admin', 'upper_room_leader'));
