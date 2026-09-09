-- ============================================================
-- Phase 20: 개인 총괄 반복 준비와 일정 변경 예외
-- 원칙: 회차별 한 번만 생성, 완료·수동 기한 보존, 취소 시 검토 유지
-- ============================================================

ALTER TABLE public.cc_tasks
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.cc_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_item_key TEXT,
  ADD COLUMN IF NOT EXISTS relative_due_day INTEGER;

ALTER TABLE public.cc_publications
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS cc_tasks_template_item_unique
  ON public.cc_tasks(owner_id, occurrence_id, template_id, template_item_key)
  WHERE occurrence_id IS NOT NULL AND template_id IS NOT NULL AND template_item_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cc_occurrence_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  occurrence_id UUID NOT NULL REFERENCES public.cc_occurrences(id) ON DELETE CASCADE,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('skip_generation', 'cancelled', 'date_changed')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  prior_date DATE,
  new_date DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cc_occurrence_active_skip_unique
  ON public.cc_occurrence_exceptions(owner_id, occurrence_id)
  WHERE exception_type = 'skip_generation' AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS cc_occurrence_exceptions_lookup_idx
  ON public.cc_occurrence_exceptions(owner_id, occurrence_id, created_at DESC)
  WHERE archived_at IS NULL;

DROP TRIGGER IF EXISTS cc_occurrence_exceptions_touch_updated_at ON public.cc_occurrence_exceptions;
CREATE TRIGGER cc_occurrence_exceptions_touch_updated_at
  BEFORE UPDATE ON public.cc_occurrence_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DROP TRIGGER IF EXISTS cc_occurrence_exceptions_audit ON public.cc_occurrence_exceptions;
CREATE TRIGGER cc_occurrence_exceptions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.cc_occurrence_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit_change();

ALTER TABLE public.cc_occurrence_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_occurrence_exceptions_owner_select ON public.cc_occurrence_exceptions;
DROP POLICY IF EXISTS cc_occurrence_exceptions_owner_insert ON public.cc_occurrence_exceptions;
DROP POLICY IF EXISTS cc_occurrence_exceptions_owner_update ON public.cc_occurrence_exceptions;
CREATE POLICY cc_occurrence_exceptions_owner_select ON public.cc_occurrence_exceptions
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY cc_occurrence_exceptions_owner_insert ON public.cc_occurrence_exceptions
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY cc_occurrence_exceptions_owner_update ON public.cc_occurrence_exceptions
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.cc_apply_preparation_template(
  p_occurrence_id UUID,
  p_template_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  owner UUID := auth.uid();
  occurrence_record public.cc_occurrences%ROWTYPE;
  template_record public.cc_templates%ROWTYPE;
  template_item RECORD;
  item_key TEXT;
  relative_day INTEGER;
  due_on DATE;
  task_id UUID;
  task_ids UUID[] := '{}';
  run_key_value TEXT;
  local_today DATE := (now() AT TIME ZONE 'America/New_York')::date;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION '인증이 필요합니다.'; END IF;

  SELECT * INTO occurrence_record
  FROM public.cc_occurrences
  WHERE id = p_occurrence_id AND owner_id = owner AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION '내 일정을 찾을 수 없습니다.'; END IF;
  IF occurrence_record.status = 'cancelled' THEN RAISE EXCEPTION '취소된 일정에는 준비 업무를 만들 수 없습니다.'; END IF;
  IF occurrence_record.date_only IS NULL THEN RAISE EXCEPTION '날짜가 확정된 일정에만 양식을 적용할 수 있습니다.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.cc_occurrence_exceptions
    WHERE owner_id = owner AND occurrence_id = p_occurrence_id
      AND exception_type = 'skip_generation' AND archived_at IS NULL
  ) THEN
    RAISE EXCEPTION '준비 생성 제외가 설정된 회차입니다.';
  END IF;

  SELECT * INTO template_record
  FROM public.cc_templates
  WHERE id = p_template_id AND owner_id = owner AND is_active = true AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION '사용할 수 있는 내 양식을 찾을 수 없습니다.'; END IF;

  run_key_value := p_template_id::text || ':' || p_occurrence_id::text || ':v' || template_record.version::text;
  IF EXISTS (
    SELECT 1 FROM public.cc_template_runs
    WHERE owner_id = owner AND run_key = run_key_value
  ) THEN
    RETURN 0;
  END IF;

  FOR template_item IN
    SELECT value AS content, ordinality
    FROM jsonb_array_elements(template_record.items) WITH ORDINALITY
  LOOP
    IF length(trim(COALESCE(template_item.content->>'title', ''))) = 0 THEN
      RAISE EXCEPTION '양식 항목에 제목이 없습니다.';
    END IF;
    relative_day := COALESCE((template_item.content->>'day')::INTEGER, 0);
    due_on := occurrence_record.date_only + relative_day;
    item_key := COALESCE(
      NULLIF(template_item.content->>'key', ''),
      'v' || template_record.version::text || '-' || template_item.ordinality::text
    );

    INSERT INTO public.cc_tasks(
      owner_id, title, area, status, next_action, completion_criteria,
      due_date, priority, is_required, due_date_is_manual,
      blocked_reason, ministry_id, occurrence_id, template_id,
      template_item_key, relative_due_day, source_key
    ) VALUES (
      owner,
      template_item.content->>'title',
      (SELECT area FROM public.cc_ministries WHERE id = occurrence_record.ministry_id AND owner_id = owner),
      'planned',
      COALESCE(NULLIF(template_item.content->>'next_action', ''), (template_item.content->>'title') || ' 준비를 진행한다.'),
      COALESCE(NULLIF(template_item.content->>'completion_criteria', ''), (template_item.content->>'title') || ' 완료 여부를 직접 확인한다.'),
      due_on,
      2,
      COALESCE((template_item.content->>'required')::BOOLEAN, true),
      false,
      CASE WHEN due_on < local_today THEN '이미 지난 상대 기한 · 일정 재조정 필요' ELSE NULL END,
      occurrence_record.ministry_id,
      occurrence_record.id,
      template_record.id,
      item_key,
      relative_day,
      'template:' || template_record.id::text || ':occurrence:' || occurrence_record.id::text || ':item:' || item_key
    )
    ON CONFLICT (owner_id, occurrence_id, template_id, template_item_key)
      WHERE occurrence_id IS NOT NULL AND template_id IS NOT NULL AND template_item_key IS NOT NULL
      DO NOTHING
    RETURNING id INTO task_id;

    IF task_id IS NOT NULL THEN
      task_ids := array_append(task_ids, task_id);
    END IF;
    task_id := NULL;
  END LOOP;

  INSERT INTO public.cc_template_runs(owner_id, template_id, occurrence_id, run_key, created_task_ids)
  VALUES (owner, p_template_id, p_occurrence_id, run_key_value, task_ids)
  ON CONFLICT(owner_id, run_key) DO NOTHING;

  RETURN cardinality(task_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_reschedule_occurrence(
  p_occurrence_id UUID,
  p_new_date DATE,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  owner UUID := auth.uid();
  old_date DATE;
  local_today DATE := (now() AT TIME ZONE 'America/New_York')::date;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION '인증이 필요합니다.'; END IF;
  IF p_new_date IS NULL OR length(trim(COALESCE(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION '새 날짜와 변경 이유가 필요합니다.';
  END IF;

  SELECT date_only INTO old_date
  FROM public.cc_occurrences
  WHERE id = p_occurrence_id AND owner_id = owner AND archived_at IS NULL AND status <> 'cancelled'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '변경할 내 일정을 찾을 수 없습니다.'; END IF;
  IF old_date = p_new_date THEN RAISE EXCEPTION '현재 날짜와 다른 날짜를 선택해주세요.'; END IF;

  UPDATE public.cc_occurrences
  SET date_only = p_new_date, updated_at = now()
  WHERE id = p_occurrence_id AND owner_id = owner;

  INSERT INTO public.cc_occurrence_exceptions(owner_id, occurrence_id, exception_type, reason, prior_date, new_date)
  VALUES (owner, p_occurrence_id, 'date_changed', p_reason, old_date, p_new_date);

  UPDATE public.cc_tasks
  SET due_date = p_new_date + relative_due_day,
      blocked_reason = CASE
        WHEN p_new_date + relative_due_day < local_today THEN '일정 변경 후 상대 기한 경과 · 재조정 필요'
        WHEN blocked_reason IN ('이미 지난 상대 기한 · 일정 재조정 필요', '일정 변경 후 상대 기한 경과 · 재조정 필요') THEN NULL
        ELSE blocked_reason
      END,
      updated_at = now()
  WHERE owner_id = owner
    AND occurrence_id = p_occurrence_id
    AND template_id IS NOT NULL
    AND relative_due_day IS NOT NULL
    AND due_date_is_manual = false
    AND status NOT IN ('completed', 'cancelled');

  UPDATE public.cc_publications
  SET status = 'needs_update', updated_at = now()
  WHERE owner_id = owner AND occurrence_id = p_occurrence_id AND status = 'published';
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_cancel_occurrence(
  p_occurrence_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  owner UUID := auth.uid();
  old_date DATE;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION '인증이 필요합니다.'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) = 0 THEN RAISE EXCEPTION '취소 이유가 필요합니다.'; END IF;

  SELECT date_only INTO old_date
  FROM public.cc_occurrences
  WHERE id = p_occurrence_id AND owner_id = owner AND archived_at IS NULL AND status <> 'cancelled'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '취소할 내 일정을 찾을 수 없습니다.'; END IF;

  UPDATE public.cc_occurrences
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_occurrence_id AND owner_id = owner;

  INSERT INTO public.cc_occurrence_exceptions(owner_id, occurrence_id, exception_type, reason, prior_date)
  VALUES (owner, p_occurrence_id, 'cancelled', p_reason, old_date);

  UPDATE public.cc_tasks
  SET blocked_reason = CASE
        WHEN blocked_reason IS NULL THEN '일정 취소 · 업무 검토 필요: ' || p_reason
        ELSE blocked_reason || ' · 일정 취소 · 업무 검토 필요: ' || p_reason
      END,
      today_focus_order = NULL,
      updated_at = now()
  WHERE owner_id = owner AND occurrence_id = p_occurrence_id
    AND status NOT IN ('completed', 'cancelled');

  UPDATE public.cc_publications
  SET status = 'needs_update', updated_at = now()
  WHERE owner_id = owner AND occurrence_id = p_occurrence_id AND status = 'published';
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_skip_occurrence_preparation(
  p_occurrence_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  owner UUID := auth.uid();
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION '인증이 필요합니다.'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) = 0 THEN RAISE EXCEPTION '생성 제외 이유가 필요합니다.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.cc_occurrences
    WHERE id = p_occurrence_id AND owner_id = owner AND archived_at IS NULL AND status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION '내 활성 일정을 찾을 수 없습니다.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.cc_template_runs
    WHERE owner_id = owner AND occurrence_id = p_occurrence_id
  ) THEN
    RAISE EXCEPTION '이미 준비 업무가 생성된 회차입니다. 연결 업무를 먼저 검토해주세요.';
  END IF;

  INSERT INTO public.cc_occurrence_exceptions(owner_id, occurrence_id, exception_type, reason)
  VALUES (owner, p_occurrence_id, 'skip_generation', p_reason)
  ON CONFLICT (owner_id, occurrence_id)
    WHERE exception_type = 'skip_generation' AND archived_at IS NULL
    DO UPDATE SET reason = EXCLUDED.reason, updated_at = now();
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.cc_occurrence_exceptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_apply_preparation_template(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_reschedule_occurrence(UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_cancel_occurrence(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_skip_occurrence_preparation(UUID, TEXT) TO authenticated;
