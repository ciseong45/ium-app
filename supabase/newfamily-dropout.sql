-- 새가족 이탈 관리 컬럼 추가
-- 4주 이상 단계 변동 없는 새가족을 자동으로 이탈 처리

ALTER TABLE new_family ADD COLUMN dropped_out BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE new_family ADD COLUMN dropped_out_at TIMESTAMPTZ;

CREATE INDEX idx_new_family_dropped_out ON new_family(dropped_out);
