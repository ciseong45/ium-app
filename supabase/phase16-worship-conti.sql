-- ============================================
-- Phase 16: 예배 콘티 (큐시트 + 곡 관리)
-- ============================================

-- 1. worship_contis: 서비스별 콘티
CREATE TABLE worship_contis (
  id SERIAL PRIMARY KEY,
  service_date DATE NOT NULL,
  leader_member_id INT REFERENCES members(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL DEFAULT '주일'
    CHECK (service_type IN ('주일', '금요', '수련회', '특별', '기타')),
  theme TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_date, service_type)
);

CREATE INDEX idx_wc_date ON worship_contis(service_date);

-- 2. worship_conti_songs: 곡 순서
CREATE TABLE worship_conti_songs (
  id SERIAL PRIMARY KEY,
  conti_id INT NOT NULL REFERENCES worship_contis(id) ON DELETE CASCADE,
  song_order INT NOT NULL,
  title TEXT NOT NULL,
  song_key TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wcs_conti ON worship_conti_songs(conti_id);

-- 3. songs: 곡 라이브러리 (자동완성용)
CREATE TABLE songs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT DEFAULT '',
  default_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(title, artist)
);

-- 4. RLS 정책
ALTER TABLE worship_contis ENABLE ROW LEVEL SECURITY;
ALTER TABLE worship_conti_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wc_select" ON worship_contis FOR SELECT TO authenticated USING (true);
CREATE POLICY "wc_insert" ON worship_contis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wc_update" ON worship_contis FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wc_delete" ON worship_contis FOR DELETE TO authenticated USING (true);

CREATE POLICY "wcs_select" ON worship_conti_songs FOR SELECT TO authenticated USING (true);
CREATE POLICY "wcs_insert" ON worship_conti_songs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wcs_update" ON worship_conti_songs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wcs_delete" ON worship_conti_songs FOR DELETE TO authenticated USING (true);

CREATE POLICY "songs_select" ON songs FOR SELECT TO authenticated USING (true);
CREATE POLICY "songs_insert" ON songs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "songs_update" ON songs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
