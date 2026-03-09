-- ============================================
-- Phase 8: 사역팀 테이블
-- ============================================

-- 1. 사역팀 테이블
CREATE TABLE ministry_teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('worship', 'discipleship')),
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 멤버-사역팀 연결 테이블 (many-to-many)
CREATE TABLE member_ministry_teams (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  ministry_team_id INT NOT NULL REFERENCES ministry_teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, ministry_team_id)
);

CREATE INDEX idx_member_ministry_teams_member ON member_ministry_teams(member_id);
CREATE INDEX idx_member_ministry_teams_team ON member_ministry_teams(ministry_team_id);

-- 3. 시드 데이터
INSERT INTO ministry_teams (name, category, display_order) VALUES
  ('찬양팀', 'worship', 1),
  ('미디어팀', 'worship', 2),
  ('FD팀', 'worship', 3),
  ('새가족팀', 'discipleship', 4),
  ('일대일팀', 'discipleship', 5),
  ('순장', 'discipleship', 6);

-- 4. RLS 정책
ALTER TABLE ministry_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_ministry_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ministry_teams_select" ON ministry_teams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ministry_teams_insert" ON ministry_teams
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ministry_teams_update" ON ministry_teams
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ministry_teams_delete" ON ministry_teams
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "member_ministry_teams_select" ON member_ministry_teams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "member_ministry_teams_insert" ON member_ministry_teams
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "member_ministry_teams_delete" ON member_ministry_teams
  FOR DELETE TO authenticated USING (true);
