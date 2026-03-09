-- 역할 관리용 SECURITY DEFINER 함수
-- admin만 다른 사용자의 역할을 변경할 수 있음
-- profiles RLS에서 UPDATE는 id = auth.uid() 제한이 있으므로 이 함수가 필요

CREATE OR REPLACE FUNCTION update_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- 호출자의 역할 확인
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();

  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;

  -- 자기 자신의 역할 변경 방지
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change own role';
  END IF;

  -- 유효한 역할인지 확인
  IF new_role NOT IN ('admin', 'leader', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be admin, leader, or viewer', new_role;
  END IF;

  -- 대상 사용자 존재 확인
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- 역할 업데이트
  UPDATE profiles SET role = new_role WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
