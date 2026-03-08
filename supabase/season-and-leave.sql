-- ============================================
-- 시즌 연동 + 멤버 휴적 관리
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 새가족에 시즌 연결
ALTER TABLE new_family ADD COLUMN season_id INT REFERENCES small_group_seasons(id) ON DELETE SET NULL;

-- 2. 멤버 상태에 on_leave(휴적) 추가
ALTER TABLE members DROP CONSTRAINT members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check
  CHECK (status IN ('active', 'attending', 'inactive', 'removed', 'on_leave'));

-- 3. 멤버 휴적 기록 테이블
CREATE TABLE member_leaves (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('military', 'academic_leave', 'study_abroad', 'other')),
  reason TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return DATE,
  actual_return DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_leaves_member ON member_leaves(member_id);
CREATE INDEX idx_member_leaves_active ON member_leaves(actual_return) WHERE actual_return IS NULL;

-- RLS
ALTER TABLE member_leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaves_select" ON member_leaves FOR SELECT TO authenticated USING (true);
CREATE POLICY "leaves_insert" ON member_leaves FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "leaves_update" ON member_leaves FOR UPDATE TO authenticated USING (true);
CREATE POLICY "leaves_delete" ON member_leaves FOR DELETE TO authenticated USING (true);
