-- Phase 12: profiles 테이블 INSERT RLS 정책 추가
-- Google OAuth 가입 시 프로필 자동 생성을 위해 필요

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
