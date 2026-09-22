BEGIN;
ALTER TABLE public.new_family ADD COLUMN education_progress integer CHECK (education_progress BETWEEN 1 AND 4), ADD COLUMN education_updated_by uuid REFERENCES public.profiles(id);
-- 직접 선택한 진도와 기존 교육 차수별 기록을 구분하여 과거 기록을 보존한다.
CREATE FUNCTION public.new_family_set_simple_education(p_family_id integer, p_progress integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.new_family%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('admin','upper_room_leader')) THEN RAISE EXCEPTION '권한이 없습니다.'; END IF;
  IF p_progress IS NULL OR p_progress NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION '교육 주차를 확인해주세요.'; END IF;
  SELECT * INTO f FROM public.new_family WHERE id=p_family_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '새가족 정보를 찾을 수 없습니다.'; END IF;
  IF f.dropped_out OR f.registered_at IS NOT NULL THEN RAISE EXCEPTION '보관·정식 등록 완료된 기록은 변경할 수 없습니다.'; END IF;
  UPDATE public.new_family SET education_progress=p_progress, education_updated_by=auth.uid(), step=CASE WHEN p_progress=4 THEN 3 ELSE 2 END, step_updated_at=now() WHERE id=f.id;
END; $$;
REVOKE ALL ON FUNCTION public.new_family_set_simple_education(integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.new_family_set_simple_education(integer,integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
