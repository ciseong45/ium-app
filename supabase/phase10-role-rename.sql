-- 역할 구조 변경: leader → upper_room_leader, viewer → group_leader
-- 실행 전 반드시 백업 권장

-- 1. 기존 데이터 마이그레이션
UPDATE profiles SET role = 'upper_room_leader' WHERE role = 'leader';
UPDATE profiles SET role = 'group_leader' WHERE role = 'viewer';

-- 2. CHECK 제약 변경
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'upper_room_leader', 'group_leader'));

-- 3. update_user_role 함수 수정
CREATE OR REPLACE FUNCTION update_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change own role';
  END IF;
  IF new_role NOT IN ('admin', 'upper_room_leader', 'group_leader') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  UPDATE profiles SET role = new_role WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
