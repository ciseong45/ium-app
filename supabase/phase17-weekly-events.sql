-- ============================================
-- Phase 17: 주간 사역자료 + 행사 관리
-- ============================================

-- 1. weekly_briefs: 주차별 통합 사역자료
CREATE TABLE weekly_briefs (
  id SERIAL PRIMARY KEY,
  week_date DATE NOT NULL UNIQUE,
  title TEXT,
  sermon_title TEXT,
  sermon_scripture TEXT,
  common_content JSONB DEFAULT '{}',
  worship_content JSONB DEFAULT '{}',
  media_content JSONB DEFAULT '{}',
  newfamily_content JSONB DEFAULT '{}',
  smallgroup_content JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wb_date ON weekly_briefs(week_date);

-- 2. events: 특별행사
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT '기타'
    CHECK (event_type IN ('수련회', '연합예배', '캠프', '특별예배', '기타')),
  start_date DATE NOT NULL,
  end_date DATE,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_date ON events(start_date);

-- 3. RLS 정책
ALTER TABLE weekly_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wb_select" ON weekly_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "wb_insert" ON weekly_briefs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wb_update" ON weekly_briefs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wb_delete" ON weekly_briefs FOR DELETE TO authenticated USING (true);

CREATE POLICY "events_select" ON events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_insert" ON events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "events_update" ON events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "events_delete" ON events FOR DELETE TO authenticated USING (true);
