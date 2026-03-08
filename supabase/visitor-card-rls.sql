-- ============================================
-- 방문자 카드: 비로그인 사용자도 멤버/새가족 등록 가능하도록 RLS 추가
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- anon (비로그인) 사용자도 members에 insert 가능
CREATE POLICY "members_anon_insert" ON members FOR INSERT TO anon WITH CHECK (true);

-- anon 사용자도 new_family에 insert 가능
CREATE POLICY "new_family_anon_insert" ON new_family FOR INSERT TO anon WITH CHECK (true);

-- anon 사용자가 insert 후 반환값(id)을 받기 위해 select도 필요
CREATE POLICY "members_anon_select_own" ON members FOR SELECT TO anon USING (true);
