-- ============================================
-- Phase 3: 소그룹 편성 테이블
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 소그룹 시즌
CREATE TABLE small_group_seasons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 소그룹
CREATE TABLE small_groups (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES small_group_seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_id INT REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 소그룹 멤버 배정
CREATE TABLE small_group_members (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES small_groups(id) ON DELETE CASCADE,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, member_id)
);

-- 활성 시즌 변경 시 기존 활성 시즌 비활성화하는 함수
CREATE OR REPLACE FUNCTION deactivate_other_seasons()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE small_group_seasons SET is_active = false WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_active_season
  AFTER INSERT OR UPDATE OF is_active ON small_group_seasons
  FOR EACH ROW EXECUTE FUNCTION deactivate_other_seasons();

-- ============================================
-- Row Level Security (RLS) 정책
-- ============================================

ALTER TABLE small_group_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE small_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE small_group_members ENABLE ROW LEVEL SECURITY;

-- small_group_seasons
CREATE POLICY "seasons_select" ON small_group_seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "seasons_insert" ON small_group_seasons FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "seasons_update" ON small_group_seasons FOR UPDATE TO authenticated USING (true);
CREATE POLICY "seasons_delete" ON small_group_seasons FOR DELETE TO authenticated USING (true);

-- small_groups
CREATE POLICY "groups_select" ON small_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups_insert" ON small_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "groups_update" ON small_groups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "groups_delete" ON small_groups FOR DELETE TO authenticated USING (true);

-- small_group_members
CREATE POLICY "group_members_select" ON small_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_members_insert" ON small_group_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "group_members_update" ON small_group_members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "group_members_delete" ON small_group_members FOR DELETE TO authenticated USING (true);
