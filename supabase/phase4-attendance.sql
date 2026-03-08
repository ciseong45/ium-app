-- ============================================
-- Phase 4: 출석 관리 테이블
-- Supabase SQL Editor에서 실행하세요
-- ============================================

CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'online')),
  checked_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, week_date)
);

-- 인덱스: 날짜별 조회 성능 향상
CREATE INDEX idx_attendance_week_date ON attendance(week_date);
CREATE INDEX idx_attendance_member_id ON attendance(member_id);

-- ============================================
-- Row Level Security (RLS) 정책
-- ============================================

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select" ON attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_insert" ON attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "attendance_update" ON attendance FOR UPDATE TO authenticated USING (true);
CREATE POLICY "attendance_delete" ON attendance FOR DELETE TO authenticated USING (true);
