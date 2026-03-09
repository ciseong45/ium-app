-- phase7: 멤버 상태에 new_family, adjusting 추가 + 기존 데이터 마이그레이션
-- 멤버관리 ↔ 새가족 상태 연동을 위한 스키마 변경

-- 1. members 테이블의 status CHECK 제약조건 업데이트
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check
  CHECK (status IN ('active', 'attending', 'inactive', 'removed', 'on_leave', 'new_family', 'adjusting'));

-- 2. 기존 데이터 마이그레이션: 진행 중인 새가족 → new_family 상태
UPDATE members m
SET status = 'new_family'
FROM new_family nf
WHERE m.id = nf.member_id
  AND nf.step < 3
  AND m.status NOT IN ('on_leave', 'removed');

-- 3. 기존 데이터 마이그레이션: step=3이고 3개월 이내 → adjusting 상태
UPDATE members m
SET status = 'adjusting'
FROM new_family nf
WHERE m.id = nf.member_id
  AND nf.step = 3
  AND nf.step_updated_at > NOW() - INTERVAL '3 months'
  AND m.status NOT IN ('on_leave', 'removed');
