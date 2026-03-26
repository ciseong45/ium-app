-- ============================================
-- Phase 15: 찬양팀 라인업 배정
-- ============================================

-- 1. worship_lineups: 날짜별 라인업
CREATE TABLE worship_lineups (
  id SERIAL PRIMARY KEY,
  service_date DATE NOT NULL UNIQUE,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wl_date ON worship_lineups(service_date);

-- 2. worship_lineup_slots: 포지션별 배정
CREATE TABLE worship_lineup_slots (
  id SERIAL PRIMARY KEY,
  lineup_id INT NOT NULL REFERENCES worship_lineups(id) ON DELETE CASCADE,
  position_id INT NOT NULL REFERENCES worship_positions(id) ON DELETE CASCADE,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  slot_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wls_lineup ON worship_lineup_slots(lineup_id);
CREATE INDEX idx_wls_member ON worship_lineup_slots(member_id);

-- 3. RLS 정책
ALTER TABLE worship_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE worship_lineup_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wl_select" ON worship_lineups FOR SELECT TO authenticated USING (true);
CREATE POLICY "wl_insert" ON worship_lineups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wl_update" ON worship_lineups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wl_delete" ON worship_lineups FOR DELETE TO authenticated USING (true);

CREATE POLICY "wls_select" ON worship_lineup_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "wls_insert" ON worship_lineup_slots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wls_update" ON worship_lineup_slots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wls_delete" ON worship_lineup_slots FOR DELETE TO authenticated USING (true);
