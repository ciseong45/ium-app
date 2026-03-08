-- ============================================
-- Phase 5: 새가족 + 1:1 양육 테이블
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 새가족
CREATE TABLE new_family (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  first_visit DATE NOT NULL,
  step INT NOT NULL DEFAULT 1 CHECK (step BETWEEN 1 AND 4),
  step_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_to INT REFERENCES members(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 1:1 양육
CREATE TABLE one_to_one (
  id SERIAL PRIMARY KEY,
  mentor_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  mentee_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 양육 세션 기록
CREATE TABLE one_to_one_sessions (
  id SERIAL PRIMARY KEY,
  one_to_one_id INT NOT NULL REFERENCES one_to_one(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_number INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_new_family_step ON new_family(step);
CREATE INDEX idx_one_to_one_status ON one_to_one(status);

-- ============================================
-- Row Level Security (RLS) 정책
-- ============================================

ALTER TABLE new_family ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_to_one ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_to_one_sessions ENABLE ROW LEVEL SECURITY;

-- new_family
CREATE POLICY "new_family_select" ON new_family FOR SELECT TO authenticated USING (true);
CREATE POLICY "new_family_insert" ON new_family FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "new_family_update" ON new_family FOR UPDATE TO authenticated USING (true);
CREATE POLICY "new_family_delete" ON new_family FOR DELETE TO authenticated USING (true);

-- one_to_one
CREATE POLICY "one_to_one_select" ON one_to_one FOR SELECT TO authenticated USING (true);
CREATE POLICY "one_to_one_insert" ON one_to_one FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "one_to_one_update" ON one_to_one FOR UPDATE TO authenticated USING (true);
CREATE POLICY "one_to_one_delete" ON one_to_one FOR DELETE TO authenticated USING (true);

-- one_to_one_sessions
CREATE POLICY "sessions_select" ON one_to_one_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions_insert" ON one_to_one_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sessions_update" ON one_to_one_sessions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "sessions_delete" ON one_to_one_sessions FOR DELETE TO authenticated USING (true);
