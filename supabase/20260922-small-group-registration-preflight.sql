-- Read-only checks against the actual Supabase project before applying the registration migration.
-- Both exception queries must return zero rows. Save the counts and policy inventory for review.

SELECT g.season_id, gm.member_id, count(*) AS memberships
FROM public.small_group_members gm
JOIN public.small_groups g ON g.id=gm.group_id
GROUP BY g.season_id, gm.member_id HAVING count(*)>1;

SELECT a.id, a.season_id AS application_season, g.season_id AS assigned_group_season
FROM public.small_group_applications a
JOIN public.small_groups g ON g.id=a.assigned_group_id
WHERE a.season_id<>g.season_id;

SELECT season_id,member_id,count(*) AS pending_applications
FROM public.small_group_applications WHERE status='pending' AND member_id IS NOT NULL
GROUP BY season_id,member_id HAVING count(*)>1;

SELECT id,name FROM public.small_group_seasons WHERE length(name)>85;

SELECT season_id,status,source,count(*) AS applications
FROM public.small_group_applications GROUP BY season_id,status,source
ORDER BY season_id,status,source;

SELECT g.season_id,count(*) AS memberships
FROM public.small_group_members gm JOIN public.small_groups g ON g.id=gm.group_id
GROUP BY g.season_id ORDER BY g.season_id;

SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns WHERE table_schema='public'
  AND table_name IN ('small_group_applications','small_group_members','small_groups','new_family_enrollments')
ORDER BY table_name,ordinal_position;

SELECT to_regclass('public.new_family') AS new_family,
  to_regclass('public.new_family_enrollments') AS education_enrollments,
  to_regclass('public.new_family_courses') AS education_courses;

SELECT tablename,policyname,cmd,roles,qual,with_check
FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('small_group_applications','small_group_members','profiles')
ORDER BY tablename,policyname;

SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('assign_new_family_group','receive_new_family','link_member_to_user')
ORDER BY p.proname;

SELECT tgrelid::regclass AS table_name,tgname,pg_get_triggerdef(oid) AS definition
FROM pg_trigger WHERE NOT tgisinternal
  AND tgrelid IN (to_regclass('public.small_group_members'),to_regclass('public.new_family'),to_regclass('public.profiles'))
ORDER BY table_name,tgname;
