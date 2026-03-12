-- 멤버 이름 분리: name → last_name + first_name
-- 실행 전 반드시 백업하세요!

-- 1. 새 컬럼 추가
ALTER TABLE members ADD COLUMN last_name TEXT;
ALTER TABLE members ADD COLUMN first_name TEXT;

-- 2. 기존 데이터 마이그레이션 (한국 이름 기준: 첫 글자 = 성, 나머지 = 이름)
UPDATE members
SET
  last_name = substring(name from 1 for 1),
  first_name = substring(name from 2);

-- 3. NOT NULL 제약 조건 추가
ALTER TABLE members ALTER COLUMN last_name SET NOT NULL;
ALTER TABLE members ALTER COLUMN first_name SET NOT NULL;

-- 4. 기존 name 컬럼 삭제
ALTER TABLE members DROP COLUMN name;
