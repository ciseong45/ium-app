BEGIN;

-- Phase 24: 목양 협업의 첫 수직 기능
-- 사람별 열린 돌봄, 짧은 연락 기록, 다음 행동을 분리해 저장한다.
-- 개인 총괄 cc_* 데이터는 조회하거나 복사하지 않는다.

CREATE TABLE IF NOT EXISTS public.care_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  case_type text NOT NULL DEFAULT 'general_care'
    CHECK (case_type IN ('welcome','new_family','connection','general_care','long_absence')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','awaiting_response','paused','closed')),
  next_action text NOT NULL CHECK (length(trim(next_action)) BETWEEN 1 AND 180),
  due_date date NOT NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_contact_at timestamptz,
  closed_at timestamptz,
  closed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'closed') = (closed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.care_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_case_id uuid NOT NULL REFERENCES public.care_cases(id) ON DELETE RESTRICT,
  member_id integer NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  contact_method text NOT NULL CHECK (contact_method IN ('message','phone','in_person','other')),
  outcome text NOT NULL CHECK (outcome IN ('connected','awaiting_response','scheduling')),
  note text CHECK (note IS NULL OR length(note) <= 800),
  visibility text NOT NULL DEFAULT 'assigned_leaders'
    CHECK (visibility IN ('assigned_leaders','pastoral_only')),
  contacted_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (note IS NULL OR length(trim(note)) > 0)
);

CREATE INDEX IF NOT EXISTS care_cases_assignee_due_idx
  ON public.care_cases(assigned_to, due_date, status)
  WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS care_cases_member_idx
  ON public.care_cases(member_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS care_logs_case_date_idx
  ON public.care_logs(care_case_id, contacted_at DESC);

CREATE OR REPLACE FUNCTION public.care_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS care_cases_touch_updated_at ON public.care_cases;
CREATE TRIGGER care_cases_touch_updated_at
  BEFORE UPDATE ON public.care_cases
  FOR EACH ROW EXECUTE FUNCTION public.care_touch_updated_at();

-- 기존 직책 범위에서 접근 가능한 성도인지 판별한다.
-- 더 세분된 웰컴·새가족·목양 사역 권한은 다음 단계에서 별도 grant로 확장한다.
CREATE OR REPLACE FUNCTION public.care_can_access_member(p_member_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'admin'
        OR p.linked_member_id = p_member_id
        OR (
          p.role = 'group_leader'
          AND EXISTS (
            SELECT 1
            FROM public.small_groups sg
            JOIN public.small_group_seasons s ON s.id = sg.season_id AND s.is_active = true
            JOIN public.small_group_members gm ON gm.group_id = sg.id
            WHERE sg.leader_id = p.linked_member_id
              AND gm.member_id = p_member_id
          )
        )
        OR (
          p.role = 'upper_room_leader'
          AND EXISTS (
            SELECT 1
            FROM public.upper_rooms ur
            JOIN public.small_group_seasons s ON s.id = ur.season_id AND s.is_active = true
            JOIN public.small_groups sg ON sg.upper_room_id = ur.id
            JOIN public.small_group_members gm ON gm.group_id = sg.id
            WHERE ur.leader_id = p.linked_member_id
              AND gm.member_id = p_member_id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.care_can_access_member(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.care_can_access_member(integer) TO authenticated;

ALTER TABLE public.care_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS care_cases_select ON public.care_cases;
DROP POLICY IF EXISTS care_cases_insert ON public.care_cases;
DROP POLICY IF EXISTS care_cases_update ON public.care_cases;
CREATE POLICY care_cases_select ON public.care_cases
  FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.care_can_access_member(member_id)
  );
CREATE POLICY care_cases_insert ON public.care_cases
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.care_can_access_member(member_id)
    AND (
      assigned_to = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );
CREATE POLICY care_cases_update ON public.care_cases
  FOR UPDATE TO authenticated
  USING (public.care_can_access_member(member_id))
  WITH CHECK (public.care_can_access_member(member_id));

DROP POLICY IF EXISTS care_logs_select ON public.care_logs;
DROP POLICY IF EXISTS care_logs_insert ON public.care_logs;
CREATE POLICY care_logs_select ON public.care_logs
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR (
      visibility = 'assigned_leaders'
      AND EXISTS (
        SELECT 1 FROM public.care_cases c
        WHERE c.id = care_logs.care_case_id
          AND public.care_can_access_member(c.member_id)
      )
    )
  );
CREATE POLICY care_logs_insert ON public.care_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.care_can_access_member(member_id)
    AND EXISTS (
      SELECT 1 FROM public.care_cases c
      WHERE c.id = care_case_id AND c.member_id = care_logs.member_id
    )
    AND (
      visibility = 'assigned_leaders'
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE OR REPLACE FUNCTION public.record_care_followup(
  p_member_id integer,
  p_case_id uuid,
  p_contact_method text,
  p_outcome text,
  p_note text,
  p_visibility text,
  p_next_action text,
  p_due_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  result_case_id uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION '인증이 필요합니다.'; END IF;
  IF NOT public.care_can_access_member(p_member_id) THEN
    RAISE EXCEPTION '이 성도의 목양 기록에 접근할 수 없습니다.';
  END IF;
  IF p_contact_method NOT IN ('message','phone','in_person','other') THEN
    RAISE EXCEPTION '사용할 수 없는 연락 방법입니다.';
  END IF;
  IF p_outcome NOT IN ('connected','awaiting_response','scheduling') THEN
    RAISE EXCEPTION '사용할 수 없는 연락 결과입니다.';
  END IF;
  IF p_visibility NOT IN ('assigned_leaders','pastoral_only') THEN
    RAISE EXCEPTION '사용할 수 없는 공개 범위입니다.';
  END IF;
  IF p_visibility = 'pastoral_only'
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor AND role = 'admin') THEN
    RAISE EXCEPTION '지정 목양담당 기록 권한이 없습니다.';
  END IF;
  IF length(trim(COALESCE(p_next_action, ''))) = 0 OR length(trim(p_next_action)) > 180 THEN
    RAISE EXCEPTION '다음 행동을 확인해주세요.';
  END IF;
  IF p_due_date IS NULL THEN RAISE EXCEPTION '다음 확인 날짜가 필요합니다.'; END IF;
  IF p_note IS NOT NULL AND length(p_note) > 800 THEN RAISE EXCEPTION '메모가 너무 깁니다.'; END IF;

  IF p_case_id IS NULL THEN
    INSERT INTO public.care_cases(
      member_id, case_type, status, next_action, due_date, assigned_to, created_by, last_contact_at
    ) VALUES (
      p_member_id,
      'general_care',
      CASE WHEN p_outcome = 'awaiting_response' THEN 'awaiting_response' ELSE 'open' END,
      trim(p_next_action),
      p_due_date,
      actor,
      actor,
      now()
    ) RETURNING id INTO result_case_id;
  ELSE
    SELECT id INTO result_case_id
    FROM public.care_cases
    WHERE id = p_case_id AND member_id = p_member_id AND status <> 'closed'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '열린 돌봄을 찾을 수 없습니다.'; END IF;

    UPDATE public.care_cases
    SET status = CASE WHEN p_outcome = 'awaiting_response' THEN 'awaiting_response' ELSE 'open' END,
        next_action = trim(p_next_action),
        due_date = p_due_date,
        last_contact_at = now()
    WHERE id = result_case_id;
  END IF;

  INSERT INTO public.care_logs(
    care_case_id, member_id, contact_method, outcome, note, visibility, created_by
  ) VALUES (
    result_case_id,
    p_member_id,
    p_contact_method,
    p_outcome,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    p_visibility,
    actor
  );

  RETURN result_case_id;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.care_cases TO authenticated;
GRANT SELECT, INSERT ON public.care_logs TO authenticated;
REVOKE ALL ON FUNCTION public.record_care_followup(integer,uuid,text,text,text,text,text,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_care_followup(integer,uuid,text,text,text,text,text,date) TO authenticated;

COMMIT;
