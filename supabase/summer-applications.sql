-- ============================================
-- 여름순 신청 풀 (small_group_applications)
-- Supabase SQL Editor에서 실행하세요
-- ============================================

CREATE TABLE small_group_applications (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES small_group_seasons(id) ON DELETE CASCADE,
  member_id INT REFERENCES members(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'cancelled')),
  assigned_group_id INT REFERENCES small_groups(id) ON DELETE SET NULL,
  note TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_pool ON small_group_applications(season_id, status);
CREATE INDEX idx_applications_member ON small_group_applications(member_id);

-- RLS
ALTER TABLE small_group_applications ENABLE ROW LEVEL SECURITY;

-- 공개 폼: 활성 시즌 조회 허용
CREATE POLICY "seasons_anon_select_active" ON small_group_seasons
  FOR SELECT TO anon USING (is_active = true);

-- 공개 폼: 비로그인(anon) 신청 허용
CREATE POLICY "applications_anon_insert" ON small_group_applications
  FOR INSERT TO anon WITH CHECK (source = 'form');

-- 인증 사용자: 전체 CRUD
CREATE POLICY "applications_select" ON small_group_applications
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "applications_insert" ON small_group_applications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "applications_update" ON small_group_applications
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "applications_delete" ON small_group_applications
  FOR DELETE TO authenticated USING (true);
