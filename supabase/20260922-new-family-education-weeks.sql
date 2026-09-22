BEGIN;
ALTER TABLE public.new_family_courses ADD COLUMN total_weeks integer NOT NULL DEFAULT 3 CHECK (total_weeks BETWEEN 1 AND 52);
ALTER TABLE public.new_family_enrollments ADD COLUMN current_week integer CHECK (current_week BETWEEN 1 AND 52);
-- 과거 참여 기록의 주차는 추정하지 않는다. 수료 기록은 기존 상태로 보존한다.
CREATE FUNCTION public.new_family_set_progress(p_family_id integer, p_course_id integer, p_week integer, p_complete boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.new_family%ROWTYPE; weeks integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('admin','upper_room_leader')) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;
  SELECT * INTO f FROM public.new_family WHERE id=p_family_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '새가족 정보를 찾을 수 없습니다.'; END IF;
  IF f.dropped_out OR f.registered_at IS NOT NULL OR f.step=3 THEN
    RAISE EXCEPTION '보관·수료·등록 완료된 기록은 주차를 변경할 수 없습니다.';
  END IF;
  SELECT total_weeks INTO weeks FROM public.new_family_courses WHERE id=p_course_id FOR SHARE;
  IF weeks IS NULL OR p_week IS NULL OR p_week < 1 OR p_week > weeks OR p_complete IS NULL THEN
    RAISE EXCEPTION '교육 차수와 주차를 확인해주세요.';
  END IF;
  IF p_complete AND (p_week <> weeks OR NOT EXISTS (
    SELECT 1 FROM public.new_family_enrollments WHERE family_id=f.id AND course_id=p_course_id AND status='in_progress' AND current_week=weeks
  )) THEN RAISE EXCEPTION '마지막 주차 기록을 먼저 확인해주세요.'; END IF;
  PERFORM public.new_family_manage(f.id,'education',p_course_id,CASE WHEN p_complete THEN 'completed' ELSE 'in_progress' END);
  UPDATE public.new_family_enrollments SET current_week=p_week WHERE family_id=f.id AND course_id=p_course_id;
END; $$;
REVOKE ALL ON FUNCTION public.new_family_set_progress(integer,integer,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.new_family_set_progress(integer,integer,integer,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
