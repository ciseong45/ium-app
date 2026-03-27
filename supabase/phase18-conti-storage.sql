-- Phase 18: conti-assets Storage 버킷 생성 및 RLS 정책
-- Supabase 대시보드 SQL Editor에서 실행하세요.

-- 1. 버킷 생성 (public으로 설정하여 getPublicUrl 사용 가능)
INSERT INTO storage.buckets (id, name, public)
VALUES ('conti-assets', 'conti-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. 인증된 사용자가 업로드(INSERT)할 수 있도록
CREATE POLICY "Allow authenticated uploads to conti-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'conti-assets');

-- 3. 누구나 읽기(SELECT) 가능 (public 버킷)
CREATE POLICY "Allow public read of conti-assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'conti-assets');

-- 4. 인증된 사용자가 삭제(DELETE)할 수 있도록
CREATE POLICY "Allow authenticated deletes from conti-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'conti-assets');
