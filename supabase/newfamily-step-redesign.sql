-- ============================================
-- 새가족 단계 재설계: 3단계 시스템
-- 1주차 방문 → 2주차 교육 → 3주차 교육 → 등록 완료 (멤버 자동 전환)
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- step CHECK 제약조건 변경 (1-4 → 1-3)
ALTER TABLE new_family DROP CONSTRAINT new_family_step_check;
ALTER TABLE new_family ADD CONSTRAINT new_family_step_check CHECK (step BETWEEN 1 AND 3);

-- 기존 step 4 데이터가 있다면 3으로 변경
UPDATE new_family SET step = 3 WHERE step = 4;
