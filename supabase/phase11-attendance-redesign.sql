-- 출석관리 재설계: 순 기반 출석 + 기도필요

-- 1. profiles에 linked_member_id 추가 (사용자 계정 ↔ 멤버 연결)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS linked_member_id INT REFERENCES members(id) ON DELETE SET NULL;

-- 2. attendance 테이블에 기도필요 필드 추가
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS prayer_request BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prayer_note TEXT;

-- 3. link_member_to_user RPC 함수 (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION link_member_to_user(
  target_user_id UUID,
  member_id_to_link INT
) RETURNS VOID AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can link members';
  END IF;
  UPDATE profiles
    SET linked_member_id = member_id_to_link
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
