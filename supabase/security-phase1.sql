-- Phase 1A: 익명 사용자 members SELECT 제한
-- 문제: members_anon_select_own 정책이 USING(true) → 비로그인 상태에서 전체 멤버 데이터 조회 가능
-- 수정: 방금 생성된 new_family 레코드만 SELECT 허용 (방문자 카드 제출 시 .insert().select("id") 정상 동작)

DROP POLICY IF EXISTS "members_anon_select_own" ON members;
CREATE POLICY "members_anon_select_recent" ON members
  FOR SELECT TO anon
  USING (status = 'new_family' AND created_at > now() - interval '2 minutes');
