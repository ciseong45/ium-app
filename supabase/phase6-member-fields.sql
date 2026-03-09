-- ============================================
-- Phase 6: 멤버 추가 필드 (카카오ID, 세례여부, 학교/직장)
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 카카오톡 ID
ALTER TABLE members ADD COLUMN IF NOT EXISTS kakao_id TEXT;

-- 2. 세례입교 여부
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_baptized BOOLEAN NOT NULL DEFAULT false;

-- 3. 학교/직장
ALTER TABLE members ADD COLUMN IF NOT EXISTS school_or_work TEXT;
