-- Phase 9: 다락방(Upper Room) 계층 추가
-- 시즌 → 다락방 → 순 → 멤버 구조

-- 다락방 테이블
CREATE TABLE upper_rooms (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season_id BIGINT NOT NULL REFERENCES small_group_seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
  display_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- small_groups에 upper_room_id FK 추가
ALTER TABLE small_groups
  ADD COLUMN upper_room_id BIGINT REFERENCES upper_rooms(id) ON DELETE CASCADE;

-- 기존 데이터 마이그레이션: 각 시즌에 3개 다락방 생성, 기존 순은 1다락방에 배정
DO $$
DECLARE
  s RECORD;
  ur_id BIGINT;
BEGIN
  FOR s IN SELECT id FROM small_group_seasons LOOP
    -- 1다락방 생성 + 기존 순 배정
    INSERT INTO upper_rooms (season_id, name, display_order)
    VALUES (s.id, '1다락방', 1) RETURNING id INTO ur_id;

    UPDATE small_groups SET upper_room_id = ur_id WHERE season_id = s.id;

    -- 2다락방, 3다락방 생성
    INSERT INTO upper_rooms (season_id, name, display_order)
    VALUES (s.id, '2다락방', 2), (s.id, '3다락방', 3);
  END LOOP;
END $$;

-- NOT NULL 제약 추가
ALTER TABLE small_groups ALTER COLUMN upper_room_id SET NOT NULL;

-- RLS
ALTER TABLE upper_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read upper_rooms"
  ON upper_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage upper_rooms"
  ON upper_rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX idx_upper_rooms_season ON upper_rooms(season_id);
CREATE INDEX idx_small_groups_upper_room ON small_groups(upper_room_id);
