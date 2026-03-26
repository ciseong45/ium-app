-- ============================================
-- Phase 14: 찬양팀 관리 기반
-- ============================================

-- 1. worship_positions: 포지션 목록
CREATE TABLE worship_positions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 시드 데이터
INSERT INTO worship_positions (name, display_order) VALUES
  ('인도', 1),
  ('어쿠', 2),
  ('건반', 3),
  ('드럼', 4),
  ('베이스', 5),
  ('일렉', 6),
  ('카혼/퍼커션', 7),
  ('바이올린', 8),
  ('싱어', 9),
  ('엔지니어', 10),
  ('라이브', 11);

-- 2. worship_member_positions: 멤버 × 포지션 능력 매트릭스
CREATE TABLE worship_member_positions (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  position_id INT NOT NULL REFERENCES worship_positions(id) ON DELETE CASCADE,
  is_capable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, position_id)
);

CREATE INDEX idx_wmp_member ON worship_member_positions(member_id);
CREATE INDEX idx_wmp_position ON worship_member_positions(position_id);

-- 3. worship_attendance: 찬양팀 출석 / 사유
CREATE TABLE worship_attendance (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  is_present BOOLEAN NOT NULL DEFAULT true,
  absence_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, week_date)
);

CREATE INDEX idx_wa_date ON worship_attendance(week_date);
CREATE INDEX idx_wa_member ON worship_attendance(member_id);

-- 4. RLS 정책
ALTER TABLE worship_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE worship_member_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE worship_attendance ENABLE ROW LEVEL SECURITY;

-- worship_positions: 읽기 전용 (시드 데이터)
CREATE POLICY "worship_positions_select" ON worship_positions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "worship_positions_insert" ON worship_positions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "worship_positions_update" ON worship_positions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "worship_positions_delete" ON worship_positions
  FOR DELETE TO authenticated USING (true);

-- worship_member_positions
CREATE POLICY "wmp_select" ON worship_member_positions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "wmp_insert" ON worship_member_positions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wmp_update" ON worship_member_positions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wmp_delete" ON worship_member_positions
  FOR DELETE TO authenticated USING (true);

-- worship_attendance
CREATE POLICY "wa_select" ON worship_attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_insert" ON worship_attendance
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wa_update" ON worship_attendance
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wa_delete" ON worship_attendance
  FOR DELETE TO authenticated USING (true);
