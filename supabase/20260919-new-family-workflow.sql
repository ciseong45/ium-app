BEGIN;
-- 방문·교육·정식 등록을 분리한다. 기존 교육 진도는 보존한다.
ALTER TABLE public.members DROP CONSTRAINT members_status_check;
ALTER TABLE public.members ADD CONSTRAINT members_status_check
  CHECK (status IN ('active','attending','inactive','removed','on_leave','new_family','adjusting','visitor'));
ALTER TABLE public.new_family
  ADD COLUMN registered_at timestamptz,
  ADD COLUMN registered_by uuid REFERENCES public.profiles(id),
  ADD COLUMN registration_source text CHECK (registration_source IN ('confirmed','legacy')),
  ADD CONSTRAINT new_family_registration_presence CHECK ((registered_at IS NULL) = (registration_source IS NULL)),
  ADD CONSTRAINT new_family_registration_pair CHECK (
    (registered_at IS NULL AND registered_by IS NULL AND registration_source IS NULL)
    OR (registered_at IS NOT NULL AND registration_source = 'legacy')
    OR (registered_at IS NOT NULL AND registered_by IS NOT NULL AND registration_source = 'confirmed')
  );
-- 과거의 명시적 연결 완료 기록만 보존한다. 다른 상태라는 이유로 등록을 추정하지 않는다.
UPDATE public.new_family nf SET registered_at = log.changed_at, registered_by = log.changed_by, registration_source = 'legacy'
FROM (
  SELECT DISTINCT ON (member_id) member_id, changed_at, changed_by
  FROM public.member_status_log WHERE old_status = 'adjusting' AND new_status = 'attending'
  ORDER BY member_id, changed_at DESC
) log WHERE nf.member_id = log.member_id AND nf.step = 3;

CREATE TABLE public.new_family_courses (
  id serial PRIMARY KEY,
  season_id integer NOT NULL REFERENCES public.small_group_seasons(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  starts_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id, name)
);
CREATE TABLE public.new_family_enrollments (
  id serial PRIMARY KEY,
  family_id integer NOT NULL REFERENCES public.new_family(id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES public.new_family_courses(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('scheduled','in_progress','completed')),
  completed_at timestamptz,
  updated_by uuid REFERENCES public.profiles(id),
  UNIQUE(family_id, course_id),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
ALTER TABLE public.new_family_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.new_family_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY courses_read ON public.new_family_courses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','upper_room_leader','group_leader')));
CREATE POLICY courses_create ON public.new_family_courses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','upper_room_leader')));
CREATE POLICY enrollments_read ON public.new_family_enrollments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','upper_room_leader','group_leader')));
GRANT SELECT, INSERT ON public.new_family_courses TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.new_family_courses_id_seq TO authenticated;
GRANT SELECT ON public.new_family_enrollments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.new_family_enrollments FROM anon, authenticated;

-- 모든 변경 함수는 인증과 역할을 DB에서 다시 확인한다.
CREATE FUNCTION public.new_family_manage(p_family_id integer, p_action text, p_course_id integer DEFAULT NULL, p_status text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.new_family%ROWTYPE; old_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','upper_room_leader')) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;
  SELECT * INTO f FROM public.new_family WHERE id = p_family_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '새가족 정보를 찾을 수 없습니다.'; END IF;
  SELECT status INTO old_status FROM public.members WHERE id = f.member_id FOR UPDATE;
  IF p_action = 'education' THEN
    IF f.dropped_out OR f.registered_at IS NOT NULL THEN RAISE EXCEPTION '보관 또는 등록 완료된 기록은 교육을 변경할 수 없습니다.'; END IF;
    IF p_status IS NULL OR p_status NOT IN ('scheduled','in_progress','completed') OR p_course_id IS NULL THEN
      RAISE EXCEPTION '교육 차수와 참여 상태를 선택해주세요.';
    END IF;
    INSERT INTO public.new_family_enrollments(family_id, course_id, status, completed_at, updated_by)
      VALUES (f.id, p_course_id, p_status, CASE WHEN p_status = 'completed' THEN now() END, auth.uid())
      ON CONFLICT (family_id, course_id) DO UPDATE SET
        status = EXCLUDED.status,
        completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN COALESCE(new_family_enrollments.completed_at, now()) END,
        updated_by = auth.uid();
    UPDATE public.new_family SET step = CASE
      WHEN EXISTS (SELECT 1 FROM public.new_family_enrollments WHERE family_id = f.id AND status = 'completed') THEN 3
      WHEN EXISTS (SELECT 1 FROM public.new_family_enrollments WHERE family_id = f.id AND status = 'in_progress') THEN 2
      ELSE 1 END, step_updated_at = now() WHERE id = f.id;
    -- 교육 기록은 멤버의 소속 상태를 변경하지 않는다.
  ELSIF p_action = 'register' THEN
    IF f.registered_at IS NOT NULL THEN RETURN; END IF;
    IF f.dropped_out OR f.step <> 3 OR old_status IN ('removed','on_leave') THEN
      RAISE EXCEPTION '교육 이수와 현재 참여 상태를 확인해주세요.';
    END IF;
    UPDATE public.new_family SET registered_at = now(), registered_by = auth.uid(), registration_source = 'confirmed' WHERE id = f.id;
    UPDATE public.members SET status = 'active' WHERE id = f.member_id;
    INSERT INTO public.member_status_log(member_id, old_status, new_status, changed_by)
      VALUES (f.member_id, old_status, 'active', auth.uid());
  ELSIF p_action = 'restore' THEN
    -- 교육 이력과 등록 확정 기록을 보존한다.
    UPDATE public.new_family SET dropped_out = false, dropped_out_at = NULL WHERE id = f.id;
  ELSE RAISE EXCEPTION '지원하지 않는 작업입니다.';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.new_family_manage(integer,text,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.new_family_manage(integer,text,integer,text) TO authenticated;

-- 등록 확정 기록은 위 함수에서만 수정할 수 있다.
CREATE FUNCTION public.guard_new_family_registration() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND (
    (TG_OP = 'INSERT' AND (NEW.registered_at IS NOT NULL OR NEW.registered_by IS NOT NULL OR NEW.registration_source IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND (NEW.registered_at, NEW.registered_by, NEW.registration_source)
      IS DISTINCT FROM (OLD.registered_at, OLD.registered_by, OLD.registration_source))
  ) THEN RAISE EXCEPTION '담당자 정식 등록 기능을 사용해주세요.'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_new_family_registration BEFORE INSERT OR UPDATE ON public.new_family
  FOR EACH ROW EXECUTE FUNCTION public.guard_new_family_registration();

-- 일반 멤버 편집에서 방문자를 곧바로 재적 처리하여 확정을 우회할 수 없다.
CREATE FUNCTION public.guard_new_family_member_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('active','attending','adjusting')
    AND EXISTS (SELECT 1 FROM public.new_family WHERE member_id = NEW.id AND registered_at IS NULL) THEN
    RAISE EXCEPTION '방문·새가족 화면에서 교육 이수 후 정식 등록을 확정해주세요.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_new_family_member_status BEFORE UPDATE OF status ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.guard_new_family_member_status();

-- 방문자도 실제 순 편성 명단에 들어간다. 활성 시즌이 없으면 등록을 실패시켜 누락을 막는다.
CREATE FUNCTION public.assign_new_family_group() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid integer; gid integer; rid bigint;
BEGIN
  SELECT id INTO sid FROM public.small_group_seasons WHERE is_active ORDER BY id DESC LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION '활성 학기를 먼저 설정해주세요.'; END IF;
  PERFORM pg_advisory_xact_lock(260919, sid);
  SELECT id INTO gid FROM public.small_groups WHERE season_id = sid AND name = '새가족순' ORDER BY id LIMIT 1;
  IF gid IS NULL THEN
    SELECT id INTO rid FROM public.upper_rooms WHERE season_id = sid AND name = '새가족' ORDER BY id LIMIT 1;
    IF rid IS NULL THEN INSERT INTO public.upper_rooms(season_id, name) VALUES(sid, '새가족') RETURNING id INTO rid; END IF;
    INSERT INTO public.small_groups(season_id, upper_room_id, name) VALUES(sid, rid, '새가족순') RETURNING id INTO gid;
  END IF;
  INSERT INTO public.small_group_members(group_id, member_id) VALUES(gid, NEW.member_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER assign_new_family_group AFTER INSERT ON public.new_family
  FOR EACH ROW EXECUTE FUNCTION public.assign_new_family_group();

-- 방문 카드와 내부 접수를 한 트랜잭션으로 저장한다. 공개 호출에서 기존 개인정보를 반환하지 않는다.
CREATE FUNCTION public.receive_new_family(p_data jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid integer; sid integer; visit_sid integer; aid integer; visit_date date;
BEGIN
  IF length(trim(COALESCE(p_data->>'last_name',''))) NOT BETWEEN 1 AND 10
     OR length(trim(COALESCE(p_data->>'first_name',''))) NOT BETWEEN 1 AND 40
     OR length(COALESCE(p_data->>'phone','')) > 20
     OR length(COALESCE(p_data->>'kakao_id','')) > 50
     OR length(COALESCE(p_data->>'school_or_work','')) > 100
     OR length(COALESCE(p_data->>'notes','')) > 1000 THEN RAISE EXCEPTION '입력 내용을 확인해주세요.'; END IF;
  SELECT id INTO sid FROM public.small_group_seasons WHERE is_active ORDER BY id DESC LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION '활성 학기를 먼저 설정해주세요.'; END IF;
  visit_date := (now() AT TIME ZONE 'America/New_York')::date;
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','upper_room_leader')) THEN
      RAISE EXCEPTION '권한이 없습니다.';
    END IF;
    aid := NULLIF(p_data->>'assigned_to','')::integer;
    visit_date := COALESCE(NULLIF(p_data->>'first_visit','')::date, visit_date);
  END IF;
  SELECT id INTO visit_sid FROM public.small_group_seasons
    WHERE start_date <= visit_date AND end_date >= visit_date ORDER BY start_date DESC, id DESC LIMIT 1;
  INSERT INTO public.members(last_name, first_name, phone, status, gender, birth_date, kakao_id, is_baptized, school_or_work, notes)
    VALUES(trim(p_data->>'last_name'), trim(p_data->>'first_name'), NULLIF(p_data->>'phone',''), 'visitor',
      NULLIF(p_data->>'gender',''), NULLIF(p_data->>'birth_date','')::date,
      NULLIF(p_data->>'kakao_id',''), COALESCE((p_data->>'is_baptized')::boolean,false),
      NULLIF(p_data->>'school_or_work',''), NULLIF(p_data->>'notes','')) RETURNING id INTO mid;
  INSERT INTO public.new_family(member_id, first_visit, assigned_to, season_id) VALUES(mid, visit_date, aid, COALESCE(visit_sid, sid));
END; $$;
REVOKE ALL ON FUNCTION public.receive_new_family(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_new_family(jsonb) TO anon, authenticated;
-- 구버전 방문 카드 호환 정책은 앱 배포 확인 후 finalize 파일에서 제거한다.
NOTIFY pgrst, 'reload schema';
COMMIT;
