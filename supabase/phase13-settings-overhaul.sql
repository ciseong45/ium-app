-- 설정 페이지 팀원 관리 기능 개선
-- 0. profiles에 email 컬럼 추가 + 기존 데이터 백필
-- 1. CHECK 제약에 'pending' 추가
-- 2. admin_delete_user RPC 함수
-- 3. admin_update_user_name RPC 함수

-- 0. profiles에 email 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 기존 profiles에 auth.users의 email 백필
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- 1. profiles.role CHECK 제약에 'pending' 추가
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'upper_room_leader', 'group_leader', 'pending'));

-- 2. 사용자 삭제 (admin 전용)
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();

  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  DELETE FROM profiles WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 사용자 이름 변경 (admin 전용)
CREATE OR REPLACE FUNCTION admin_update_user_name(target_user_id UUID, new_name TEXT)
RETURNS VOID AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();

  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user names';
  END IF;

  IF TRIM(COALESCE(new_name, '')) = '' THEN
    RAISE EXCEPTION 'Name cannot be empty';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE profiles SET name = TRIM(new_name) WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
