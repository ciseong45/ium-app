-- ============================================
-- Phase 2: 멤버 관리 테이블
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. profiles 테이블 (관리자 사용자 프로필)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'leader', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 새 사용자 가입 시 자동으로 profiles에 추가
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), 'viewer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 기존 사용자도 profiles에 추가
INSERT INTO profiles (id, name, role)
SELECT id, COALESCE(raw_user_meta_data->>'name', ''), 'admin'
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);

-- 2. members 테이블 (교회 멤버)
CREATE TABLE members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  gender TEXT CHECK (gender IN ('M', 'F')),
  birth_date DATE,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'attending', 'inactive', 'removed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. member_status_log 테이블 (상태 변경 이력)
CREATE TABLE member_status_log (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Row Level Security (RLS) 정책
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_status_log ENABLE ROW LEVEL SECURITY;

-- profiles: 로그인한 사용자는 모든 프로필 조회 가능, 자신의 프로필만 수정 가능
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- members: 로그인한 사용자는 모든 멤버 CRUD 가능
CREATE POLICY "members_select" ON members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_insert" ON members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "members_update" ON members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "members_delete" ON members FOR DELETE TO authenticated USING (true);

-- member_status_log: 로그인한 사용자는 조회/삽입 가능
CREATE POLICY "status_log_select" ON member_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "status_log_insert" ON member_status_log FOR INSERT TO authenticated WITH CHECK (true);
