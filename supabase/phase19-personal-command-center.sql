-- ============================================================
-- Phase 19: 이음채플 개인 총괄 시스템
-- 설계 기준: 이음채플 개인 총괄 시스템 상세 설계도 v1.0
-- 원칙: 관리자 개인 소유, owner_id 기반 RLS, 삭제 대신 보관
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.cc_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  goal TEXT,
  retrospective TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  source_key TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, source_key),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.cc_ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.cc_seasons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  area TEXT NOT NULL CHECK (area IN (
    'worship_word', 'formation_leadership', 'newcomer_care',
    'community_events', 'admin_finance', 'media_tech'
  )),
  kind TEXT NOT NULL CHECK (kind IN ('recurring', 'course', 'project')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
  purpose TEXT,
  start_date DATE,
  end_date DATE,
  current_blocker TEXT,
  source_url TEXT,
  last_reviewed_at TIMESTAMPTZ,
  source_key TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, source_key),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.cc_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES public.cc_ministries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'tentative' CHECK (status IN ('tentative', 'confirmed', 'cancelled')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  date_only DATE,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  location TEXT,
  sequence_label TEXT,
  source_key TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, source_key),
  CHECK (date_only IS NOT NULL OR starts_at IS NOT NULL),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS public.cc_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL CHECK (length(trim(original_text)) > 0),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'unprocessed' CHECK (status IN ('unprocessed', 'processed', 'duplicate', 'archived')),
  produced_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  dedupe_key TEXT NOT NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cc_inbox_active_dedupe
  ON public.cc_inbox(owner_id, dedupe_key)
  WHERE archived_at IS NULL AND status <> 'duplicate';

CREATE TABLE IF NOT EXISTS public.cc_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  area TEXT NOT NULL CHECK (area IN (
    'worship_word', 'formation_leadership', 'newcomer_care',
    'community_events', 'admin_finance', 'media_tech'
  )),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'waiting', 'on_hold', 'completed', 'cancelled')),
  next_action TEXT,
  completion_criteria TEXT,
  due_date DATE,
  scheduled_date DATE,
  priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4),
  is_required BOOLEAN NOT NULL DEFAULT true,
  due_date_is_manual BOOLEAN NOT NULL DEFAULT false,
  blocked_reason TEXT,
  ministry_id UUID REFERENCES public.cc_ministries(id) ON DELETE SET NULL,
  occurrence_id UUID REFERENCES public.cc_occurrences(id) ON DELETE SET NULL,
  source_inbox_id UUID REFERENCES public.cc_inbox(id) ON DELETE SET NULL,
  today_focus_order SMALLINT CHECK (today_focus_order BETWEEN 1 AND 3),
  completion_evidence TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  source_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, source_key),
  CHECK (status NOT IN ('in_progress', 'waiting') OR length(trim(COALESCE(next_action, ''))) > 0),
  CHECK (status <> 'completed' OR (completed_at IS NOT NULL AND length(trim(COALESCE(completion_evidence, ''))) > 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS cc_tasks_focus_order_unique
  ON public.cc_tasks(owner_id, today_focus_order)
  WHERE today_focus_order IS NOT NULL AND archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cc_tasks_inbox_title_unique
  ON public.cc_tasks(owner_id, source_inbox_id, title)
  WHERE source_inbox_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cc_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.cc_tasks(id) ON DELETE CASCADE,
  request_text TEXT NOT NULL,
  person_label TEXT NOT NULL,
  requested_at DATE NOT NULL,
  next_check_date DATE NOT NULL,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'received', 'closed')),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cc_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ministry_id UUID REFERENCES public.cc_ministries(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'decided', 'cancelled')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_information TEXT,
  confirmed_choice TEXT,
  basis TEXT,
  due_date DATE,
  decided_at TIMESTAMPTZ,
  source_key TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, source_key),
  CHECK (status <> 'decided' OR (decided_at IS NOT NULL AND length(trim(COALESCE(confirmed_choice, ''))) > 0))
);

CREATE TABLE IF NOT EXISTS public.cc_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ministry_id UUID REFERENCES public.cc_ministries(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT '문서',
  version_status TEXT NOT NULL DEFAULT 'draft' CHECK (version_status IN ('draft', 'confirmed', 'superseded')),
  reference_date DATE,
  verified_at TIMESTAMPTZ,
  access_scope TEXT,
  source_key TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.cc_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  occurrence_id UUID REFERENCES public.cc_occurrences(id) ON DELETE SET NULL,
  resource_id UUID REFERENCES public.cc_resources(id) ON DELETE SET NULL,
  destination TEXT NOT NULL,
  source_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpublished' CHECK (status IN ('unpublished', 'published', 'needs_update')),
  published_url TEXT,
  published_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cc_person_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  external_system TEXT NOT NULL,
  external_person_id TEXT NOT NULL,
  display_name TEXT,
  last_verified_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, external_system, external_person_id)
);

CREATE TABLE IF NOT EXISTS public.cc_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ministry_id UUID REFERENCES public.cc_ministries(id) ON DELETE SET NULL,
  item TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'approval_pending', 'approved', 'paid', 'cancelled')),
  approved_at TIMESTAMPTZ,
  receipt_url TEXT,
  paid_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cc_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  applies_to TEXT NOT NULL CHECK (applies_to IN ('worship', 'course', 'event', 'newcomer')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source_key TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, source_key),
  UNIQUE(owner_id, name, version)
);

CREATE TABLE IF NOT EXISTS public.cc_template_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.cc_templates(id) ON DELETE CASCADE,
  occurrence_id UUID NOT NULL REFERENCES public.cc_occurrences(id) ON DELETE CASCADE,
  run_key TEXT NOT NULL,
  created_task_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, run_key)
);

CREATE TABLE IF NOT EXISTS public.cc_weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  reviewed_at TIMESTAMPTZ,
  focus_task_ids UUID[] NOT NULL DEFAULT '{}',
  incomplete_judgment TEXT,
  focus_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, week_start),
  CHECK (cardinality(focus_task_ids) <= 3)
);

CREATE TABLE IF NOT EXISTS public.cc_change_log (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_table TEXT NOT NULL,
  target_id UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID NOT NULL,
  before_data JSONB,
  after_data JSONB,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS public.cc_decision_task_links (
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES public.cc_decisions(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.cc_tasks(id) ON DELETE CASCADE,
  PRIMARY KEY(decision_id, task_id)
);

CREATE TABLE IF NOT EXISTS public.cc_decision_occurrence_links (
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES public.cc_decisions(id) ON DELETE CASCADE,
  occurrence_id UUID NOT NULL REFERENCES public.cc_occurrences(id) ON DELETE CASCADE,
  PRIMARY KEY(decision_id, occurrence_id)
);

CREATE TABLE IF NOT EXISTS public.cc_resource_task_links (
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.cc_resources(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.cc_tasks(id) ON DELETE CASCADE,
  PRIMARY KEY(resource_id, task_id)
);

CREATE TABLE IF NOT EXISTS public.cc_resource_occurrence_links (
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.cc_resources(id) ON DELETE CASCADE,
  occurrence_id UUID NOT NULL REFERENCES public.cc_occurrences(id) ON DELETE CASCADE,
  PRIMARY KEY(resource_id, occurrence_id)
);

CREATE INDEX IF NOT EXISTS cc_tasks_due_idx ON public.cc_tasks(owner_id, due_date) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS cc_tasks_status_idx ON public.cc_tasks(owner_id, status) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS cc_followups_next_check_idx ON public.cc_followups(owner_id, next_check_date) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS cc_occurrences_date_idx ON public.cc_occurrences(owner_id, date_only) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS cc_decisions_due_idx ON public.cc_decisions(owner_id, due_date) WHERE archived_at IS NULL AND status = 'open';
CREATE INDEX IF NOT EXISTS cc_resources_search_idx ON public.cc_resources USING gin(to_tsvector('simple', title));

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'cc_seasons', 'cc_ministries', 'cc_occurrences', 'cc_inbox', 'cc_tasks',
    'cc_followups', 'cc_decisions', 'cc_resources', 'cc_publications',
    'cc_person_refs', 'cc_costs', 'cc_templates', 'cc_weekly_reviews'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch_updated_at ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at()',
      table_name, table_name
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner UUID;
  target UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    owner := OLD.owner_id;
    target := OLD.id;
  ELSE
    owner := NEW.owner_id;
    target := NEW.id;
  END IF;
  INSERT INTO public.cc_change_log(owner_id, target_table, target_id, changed_by, before_data, after_data)
  VALUES (
    owner,
    TG_TABLE_NAME,
    target,
    COALESCE(auth.uid(), owner),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'cc_seasons', 'cc_ministries', 'cc_occurrences', 'cc_inbox', 'cc_tasks',
    'cc_followups', 'cc_decisions', 'cc_resources', 'cc_publications',
    'cc_person_refs', 'cc_costs', 'cc_templates', 'cc_weekly_reviews'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_audit ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.cc_audit_change()',
      table_name, table_name
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'cc_seasons', 'cc_ministries', 'cc_occurrences', 'cc_inbox', 'cc_tasks',
    'cc_followups', 'cc_decisions', 'cc_resources', 'cc_publications',
    'cc_person_refs', 'cc_costs', 'cc_templates', 'cc_template_runs',
    'cc_weekly_reviews', 'cc_decision_task_links',
    'cc_decision_occurrence_links', 'cc_resource_task_links', 'cc_resource_occurrence_links'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner_all ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner_select ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner_insert ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner_update ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_owner_select ON public.%I FOR SELECT TO authenticated USING (owner_id = auth.uid())',
      table_name, table_name
    );
    EXECUTE format(
      'CREATE POLICY %I_owner_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid())',
      table_name, table_name
    );
    EXECUTE format(
      'CREATE POLICY %I_owner_update ON public.%I FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())',
      table_name, table_name
    );
  END LOOP;
END;
$$;

ALTER TABLE public.cc_change_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_change_log_owner_all ON public.cc_change_log;
DROP POLICY IF EXISTS cc_change_log_owner_select ON public.cc_change_log;
CREATE POLICY cc_change_log_owner_select ON public.cc_change_log
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.cc_inbox_to_task(
  p_inbox_id UUID,
  p_title TEXT,
  p_next_action TEXT,
  p_area TEXT,
  p_due_date DATE DEFAULT NULL,
  p_ministry_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  task_id UUID;
BEGIN
  SELECT id INTO task_id
  FROM public.cc_tasks
  WHERE owner_id = auth.uid() AND source_inbox_id = p_inbox_id AND title = p_title;

  IF task_id IS NULL THEN
    INSERT INTO public.cc_tasks(
      owner_id, title, area, status, next_action, due_date, due_date_is_manual,
      ministry_id, source_inbox_id
    )
    SELECT auth.uid(), p_title, p_area, 'planned', p_next_action, p_due_date,
      p_due_date IS NOT NULL, p_ministry_id, i.id
    FROM public.cc_inbox i
    WHERE i.id = p_inbox_id AND i.owner_id = auth.uid()
    RETURNING id INTO task_id;
  END IF;

  IF task_id IS NULL THEN
    RAISE EXCEPTION '수집 기록을 찾을 수 없습니다.';
  END IF;

  UPDATE public.cc_inbox
  SET status = 'processed',
      produced_records = CASE
        WHEN produced_records @> jsonb_build_array(jsonb_build_object('type', 'task', 'id', task_id::text))
          THEN produced_records
        ELSE produced_records || jsonb_build_array(jsonb_build_object('type', 'task', 'id', task_id::text))
      END
  WHERE id = p_inbox_id AND owner_id = auth.uid();

  RETURN task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_start_waiting(
  p_task_id UUID,
  p_person_label TEXT,
  p_request_text TEXT,
  p_requested_at DATE,
  p_next_check_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  followup_id UUID;
BEGIN
  IF length(trim(p_person_label)) = 0 OR length(trim(p_request_text)) = 0 OR p_next_check_date IS NULL THEN
    RAISE EXCEPTION '응답 대기 필수 정보가 누락되었습니다.';
  END IF;

  INSERT INTO public.cc_followups(owner_id, task_id, person_label, request_text, requested_at, next_check_date)
  SELECT auth.uid(), id, p_person_label, p_request_text, p_requested_at, p_next_check_date
  FROM public.cc_tasks
  WHERE id = p_task_id AND owner_id = auth.uid() AND status = 'in_progress'
  RETURNING id INTO followup_id;

  IF followup_id IS NULL THEN
    RAISE EXCEPTION '진행 중인 내 업무만 응답 대기로 바꿀 수 있습니다.';
  END IF;

  UPDATE public.cc_tasks SET status = 'waiting' WHERE id = p_task_id AND owner_id = auth.uid();
  RETURN followup_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_record_followup_response(
  p_followup_id UUID,
  p_response_text TEXT,
  p_next_action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  related_task UUID;
BEGIN
  UPDATE public.cc_followups
  SET response_text = p_response_text, responded_at = now(), status = 'received'
  WHERE id = p_followup_id AND owner_id = auth.uid() AND status = 'waiting'
  RETURNING task_id INTO related_task;

  IF related_task IS NULL THEN
    RAISE EXCEPTION '대기 중인 요청을 찾을 수 없습니다.';
  END IF;

  UPDATE public.cc_tasks
  SET status = 'in_progress', next_action = p_next_action
  WHERE id = related_task AND owner_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_transition_task(
  p_task_id UUID,
  p_next_status TEXT,
  p_note TEXT DEFAULT NULL,
  p_next_action TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_status TEXT;
  allowed BOOLEAN := false;
BEGIN
  SELECT status INTO current_status
  FROM public.cc_tasks
  WHERE id = p_task_id AND owner_id = auth.uid();

  IF current_status IS NULL THEN RAISE EXCEPTION '업무를 찾을 수 없습니다.'; END IF;
  IF p_next_status = 'waiting' THEN RAISE EXCEPTION '요청 이력과 함께 응답 대기로 바꿔주세요.'; END IF;

  allowed := CASE current_status
    WHEN 'planned' THEN p_next_status IN ('in_progress', 'on_hold', 'cancelled')
    WHEN 'in_progress' THEN p_next_status IN ('on_hold', 'completed', 'cancelled')
    WHEN 'waiting' THEN p_next_status IN ('in_progress', 'on_hold', 'cancelled')
    WHEN 'on_hold' THEN p_next_status IN ('planned', 'in_progress', 'cancelled')
    WHEN 'completed' THEN p_next_status = 'in_progress'
    WHEN 'cancelled' THEN p_next_status = 'planned'
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION '허용되지 않은 상태 전환입니다.'; END IF;

  IF current_status = 'completed' AND length(trim(COALESCE(p_note, ''))) = 0 THEN
    RAISE EXCEPTION '재개 이유가 필요합니다.';
  END IF;
  IF p_next_status IN ('on_hold', 'cancelled') AND length(trim(COALESCE(p_note, ''))) = 0 THEN
    RAISE EXCEPTION '변경 이유가 필요합니다.';
  END IF;
  IF p_next_status = 'completed' AND length(trim(COALESCE(p_note, ''))) = 0 THEN
    RAISE EXCEPTION '완료 근거가 필요합니다.';
  END IF;

  UPDATE public.cc_tasks
  SET status = p_next_status,
      next_action = COALESCE(p_next_action, next_action),
      started_at = CASE WHEN p_next_status = 'in_progress' THEN COALESCE(started_at, now()) ELSE started_at END,
      completed_at = CASE WHEN p_next_status = 'completed' THEN now() WHEN current_status = 'completed' THEN NULL ELSE completed_at END,
      completion_evidence = CASE WHEN p_next_status = 'completed' THEN p_note ELSE completion_evidence END,
      blocked_reason = CASE
        WHEN p_next_status IN ('on_hold', 'cancelled') THEN p_note
        WHEN p_next_status IN ('planned', 'in_progress', 'completed') THEN NULL
        ELSE blocked_reason
      END,
      today_focus_order = CASE WHEN p_next_status IN ('completed', 'cancelled', 'on_hold') THEN NULL ELSE today_focus_order END
  WHERE id = p_task_id AND owner_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_bootstrap_2026_fall()
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  owner UUID := auth.uid();
  season UUID;
  worship UUID;
  onboarding UUID;
  outdoor UUID;
  worship_0913 UUID;
  onboarding_0913 UUID;
  source_root TEXT := '01. Ministry/01. 이음채플/08. Planning & Strategy/사역기획/2026-2027 가을-봄학기/';
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION '인증이 필요합니다.'; END IF;

  INSERT INTO public.cc_seasons(owner_id, name, start_date, end_date, goal, is_active, source_key)
  VALUES (owner, '2026 가을', '2026-09-06', '2026-12-13',
    'FOUNDATIONS & ROOTS — 기초 위에 서서 약속 안에 뿌리내리다', true, '2026-fall')
  ON CONFLICT(owner_id, source_key) DO UPDATE SET
    name = EXCLUDED.name, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    goal = EXCLUDED.goal, is_active = true, archived_at = NULL
  RETURNING id INTO season;

  INSERT INTO public.cc_ministries(owner_id, season_id, title, area, kind, status, purpose, start_date, end_date, source_url, source_key)
  VALUES (owner, season, '주일예배', 'worship_word', 'recurring', 'active',
    '말씀과 예배를 통해 복음과 공동체의 기초를 세운다.', '2026-09-06', '2026-12-13',
    source_root || '2026 가을학기 마스터 일정.md', '2026-fall-worship')
  ON CONFLICT(owner_id, source_key) DO UPDATE SET season_id = EXCLUDED.season_id, archived_at = NULL
  RETURNING id INTO worship;

  INSERT INTO public.cc_ministries(owner_id, season_id, title, area, kind, status, purpose, start_date, end_date, current_blocker, source_url, source_key)
  VALUES (owner, season, 'In the Beginning', 'formation_leadership', 'course', 'active',
    '새가족과 기존 멤버가 함께 참여하는 3주 온보딩. 세부 목적은 사용자 확인 필요.',
    '2026-09-13', '2026-09-27', '목적·내용·진행 시점·형식·장소 확인 필요',
    source_root || '2026 In the Beginning 3주 온보딩 기획안.md', '2026-fall-onboarding')
  ON CONFLICT(owner_id, source_key) DO UPDATE SET season_id = EXCLUDED.season_id, current_blocker = EXCLUDED.current_blocker, archived_at = NULL
  RETURNING id INTO onboarding;

  INSERT INTO public.cc_ministries(owner_id, season_id, title, area, kind, status, purpose, start_date, end_date, current_blocker, source_url, source_key)
  VALUES (owner, season, '10월 4일 야외예배', 'community_events', 'project', 'active',
    '창조 말씀과 공동체 관계를 한 자리에서 경험한다.',
    '2026-09-08', '2026-10-05', '장소·허가·실내 대안·예산 상한 미확정',
    source_root || '2026 가을학기 실행 대시보드.md', '2026-fall-outdoor-worship')
  ON CONFLICT(owner_id, source_key) DO UPDATE SET season_id = EXCLUDED.season_id, current_blocker = EXCLUDED.current_blocker, archived_at = NULL
  RETURNING id INTO outdoor;

  INSERT INTO public.cc_occurrences(owner_id, ministry_id, title, status, date_only, sequence_label, source_key)
  VALUES (owner, worship, '9월 13일 주일예배', 'confirmed', '2026-09-13', '가을 2주차', 'worship-2026-09-13')
  ON CONFLICT(owner_id, source_key) DO UPDATE SET ministry_id = EXCLUDED.ministry_id, status = 'confirmed', archived_at = NULL
  RETURNING id INTO worship_0913;

  INSERT INTO public.cc_occurrences(owner_id, ministry_id, title, status, date_only, sequence_label, source_key)
  VALUES (owner, onboarding, 'In the Beginning 1주차', 'confirmed', '2026-09-13', '1/3', 'onboarding-2026-09-13')
  ON CONFLICT(owner_id, source_key) DO UPDATE SET ministry_id = EXCLUDED.ministry_id, status = 'confirmed', archived_at = NULL
  RETURNING id INTO onboarding_0913;

  INSERT INTO public.cc_occurrences(owner_id, ministry_id, title, status, date_only, sequence_label, source_key) VALUES
    (owner, worship, '9월 20일 주일예배', 'confirmed', '2026-09-20', '가을 3주차', 'worship-2026-09-20'),
    (owner, worship, '9월 27일 주일예배', 'confirmed', '2026-09-27', '가을 4주차', 'worship-2026-09-27'),
    (owner, onboarding, 'In the Beginning 2주차', 'confirmed', '2026-09-20', '2/3', 'onboarding-2026-09-20'),
    (owner, onboarding, 'In the Beginning 3주차', 'confirmed', '2026-09-27', '3/3', 'onboarding-2026-09-27'),
    (owner, outdoor, '야외예배', 'confirmed', '2026-10-04', '가을 5주차', 'outdoor-worship-2026-10-04')
  ON CONFLICT(owner_id, source_key) DO UPDATE SET ministry_id = EXCLUDED.ministry_id, status = EXCLUDED.status, date_only = EXCLUDED.date_only, archived_at = NULL;

  INSERT INTO public.cc_tasks(owner_id, title, area, status, next_action, completion_criteria, due_date, priority, is_required, ministry_id, occurrence_id, source_key) VALUES
    (owner, '9월 13일 말씀 연구와 메시지 방향', 'worship_word', 'planned', '본문과 핵심 질문을 정리한다.', '본문과 핵심 질문이 원본에 정리됨', '2026-09-08', 1, true, worship, worship_0913, 'worship-0913-d5'),
    (owner, '9월 13일 예배 순서·광고 취합', 'worship_word', 'planned', '누락 내용과 확인 사항을 구분한다.', '누락과 확인 사항이 구분된 초안 존재', '2026-09-09', 1, true, worship, worship_0913, 'worship-0913-d4'),
    (owner, 'In the Beginning 3주 개요·진행 방식 확정', 'formation_leadership', 'planned', '목적·내용·시간·형식·장소를 사용자 기준으로 확정한다.', '3주 운영안을 설명할 수 있는 확정본 존재', '2026-09-10', 1, true, onboarding, onboarding_0913, 'onboarding-plan-final'),
    (owner, 'In the Beginning 1주차 최종 자료', 'formation_leadership', 'planned', '확정된 운영안으로 1주차 자료를 완성한다.', '현장에서 사용할 최종 자료 원본 연결', '2026-09-12', 1, true, onboarding, onboarding_0913, 'onboarding-week1-final'),
    (owner, '야외예배 장소·실내 대안 확인', 'community_events', 'planned', '장소 가능 여부와 허가 조건을 확인한다.', '야외 1곳과 실내 대안의 사용 가능 여부가 확인됨', '2026-09-13', 1, true, outdoor, NULL, 'outdoor-venue'),
    (owner, '야외예배 1차 안내 준비', 'media_tech', 'planned', '확정 정보와 미확정 정보를 구분해 안내 초안을 만든다.', '9월 13일 사용할 1차 안내 초안 존재', '2026-09-13', 2, true, outdoor, NULL, 'outdoor-first-notice')
  ON CONFLICT(owner_id, source_key) DO UPDATE SET ministry_id = EXCLUDED.ministry_id, occurrence_id = EXCLUDED.occurrence_id, archived_at = NULL;

  INSERT INTO public.cc_decisions(owner_id, ministry_id, question, status, options, required_information, due_date, source_key) VALUES
    (owner, onboarding, 'In the Beginning의 목적·내용·시간·형식·장소를 어떻게 확정할 것인가?', 'open', '[]', '사용자 확인이 필요한 6개 항목', '2026-09-10', 'decision-onboarding-format'),
    (owner, outdoor, '야외예배 장소와 실내 대안을 어디로 정할 것인가?', 'open', '[]', '사용 가능 여부·허가·비용·우천 전환 조건', '2026-09-13', 'decision-outdoor-venue'),
    (owner, NULL, '2026 가을 사역 예산 상한을 얼마로 정할 것인가?', 'open', '[]', '필수 항목별 예상비용과 공식 장부 위치', '2026-09-13', 'decision-fall-budget'),
    (owner, NULL, '정규 순의 첫 모임 날짜와 편성 원칙을 어떻게 정할 것인가?', 'open', '[]', '이음앱 기준 활동 상태와 관계 정보', NULL, 'decision-group-start')
  ON CONFLICT(owner_id, source_key) DO UPDATE SET ministry_id = EXCLUDED.ministry_id, due_date = EXCLUDED.due_date, archived_at = NULL;

  INSERT INTO public.cc_resources(owner_id, ministry_id, title, source_url, resource_type, version_status, reference_date, access_scope, source_key) VALUES
    (owner, worship, '2026 가을학기 마스터 일정', source_root || '2026 가을학기 마스터 일정.md', '일정 기준', 'confirmed', '2026-08-29', '개인 Mac', 'resource-fall-master-schedule'),
    (owner, NULL, '2026 가을학기 실행 대시보드', source_root || '2026 가을학기 실행 대시보드.md', '실행 계획', 'draft', '2026-08-29', '개인 Mac', 'resource-fall-dashboard'),
    (owner, onboarding, 'In the Beginning 3주 온보딩 기획안', source_root || '2026 In the Beginning 3주 온보딩 기획안.md', '기획안', 'draft', '2026-08-29', '개인 Mac', 'resource-onboarding-plan')
  ON CONFLICT(owner_id, source_key) DO UPDATE SET ministry_id = EXCLUDED.ministry_id, source_url = EXCLUDED.source_url, archived_at = NULL;

  INSERT INTO public.cc_templates(owner_id, name, version, applies_to, items, source_key) VALUES
    (owner, '주일예배 준비', 1, 'worship',
      '[{"day":-6,"title":"이번 주 예배 정보 확인","required":true},{"day":-5,"title":"말씀 연구와 메시지 방향","required":true},{"day":-4,"title":"예배 순서·광고 취합","required":true},{"day":-3,"title":"설교 구조·큐시트 초안","required":true},{"day":-2,"title":"주보·웹·현장 준비 점검","required":true},{"day":-1,"title":"원고·진행·변경 사항 확인","required":true},{"day":0,"title":"예배 후 이슈 수집","required":true},{"day":1,"title":"후속 업무 정리","required":true}]', 'template-worship-v1'),
    (owner, '교육·양육 회차 준비', 1, 'course',
      '[{"day":-7,"title":"목적·범위 확인","required":true},{"day":-4,"title":"교안·질문 초안","required":true},{"day":-2,"title":"참여·장소·교재 확인","required":true},{"day":-1,"title":"최종 자료","required":true},{"day":0,"title":"출석·진행 기록","required":true},{"day":1,"title":"결석·질문 후속","required":true}]', 'template-course-v1'),
    (owner, '행사 준비', 1, 'event',
      '[{"day":-28,"title":"목적·날짜·예산 범위","required":true},{"day":-21,"title":"장소·대안","required":true},{"day":-14,"title":"신청·안내","required":true},{"day":-7,"title":"인원·식사·이동","required":true},{"day":-3,"title":"수량·준비물","required":true},{"day":-1,"title":"진행 여부·연락망","required":true},{"day":0,"title":"행사 실행","required":true},{"day":1,"title":"후속","required":true},{"day":7,"title":"정산·회고","required":true}]', 'template-event-v1')
  ON CONFLICT(owner_id, source_key) DO UPDATE SET items = EXCLUDED.items, is_active = true, archived_at = NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cc_inbox_to_task(UUID, TEXT, TEXT, TEXT, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_start_waiting(UUID, TEXT, TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_record_followup_response(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_transition_task(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_bootstrap_2026_fall() TO authenticated;

GRANT SELECT, INSERT, UPDATE ON
  public.cc_seasons, public.cc_ministries, public.cc_occurrences, public.cc_inbox,
  public.cc_tasks, public.cc_followups, public.cc_decisions, public.cc_resources,
  public.cc_publications, public.cc_person_refs, public.cc_costs, public.cc_templates,
  public.cc_template_runs, public.cc_weekly_reviews,
  public.cc_decision_task_links, public.cc_decision_occurrence_links,
  public.cc_resource_task_links, public.cc_resource_occurrence_links
TO authenticated;
GRANT SELECT ON public.cc_change_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cc_change_log_id_seq TO authenticated;
