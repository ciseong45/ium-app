BEGIN;
-- 이전 공개 INSERT/SELECT 정책은 폐기한다. 공개 접수는 위 함수만 사용한다.
DROP POLICY IF EXISTS members_anon_select_recent ON public.members;
DROP POLICY IF EXISTS members_anon_select_own ON public.members;
DROP POLICY IF EXISTS members_anon_insert ON public.members;
DROP POLICY IF EXISTS new_family_anon_insert ON public.new_family;
NOTIFY pgrst, 'reload schema';
COMMIT;
