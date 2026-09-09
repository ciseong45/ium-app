-- ============================================================
-- Phase 21: 개인 총괄과 기존 이음앱 사람 기록 연결
-- 원칙: 멤버 ID만 참조하고 연락처·메모·민감정보는 복제하지 않음
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cc_person_task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  person_ref_id UUID NOT NULL REFERENCES public.cc_person_refs(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.cc_tasks(id) ON DELETE CASCADE,
  relationship_label TEXT NOT NULL DEFAULT '후속' CHECK (length(trim(relationship_label)) BETWEEN 1 AND 40),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, person_ref_id, task_id)
);

CREATE INDEX IF NOT EXISTS cc_person_task_links_task_idx
  ON public.cc_person_task_links(owner_id, task_id)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS cc_person_task_links_person_idx
  ON public.cc_person_task_links(owner_id, person_ref_id)
  WHERE archived_at IS NULL;

DROP TRIGGER IF EXISTS cc_person_task_links_touch_updated_at ON public.cc_person_task_links;
CREATE TRIGGER cc_person_task_links_touch_updated_at
  BEFORE UPDATE ON public.cc_person_task_links
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DROP TRIGGER IF EXISTS cc_person_task_links_audit ON public.cc_person_task_links;
CREATE TRIGGER cc_person_task_links_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.cc_person_task_links
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit_change();

ALTER TABLE public.cc_person_task_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_person_task_links_owner_select ON public.cc_person_task_links;
DROP POLICY IF EXISTS cc_person_task_links_owner_insert ON public.cc_person_task_links;
DROP POLICY IF EXISTS cc_person_task_links_owner_update ON public.cc_person_task_links;
CREATE POLICY cc_person_task_links_owner_select ON public.cc_person_task_links
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY cc_person_task_links_owner_insert ON public.cc_person_task_links
  FOR INSERT TO authenticated WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.cc_person_refs
      WHERE id = person_ref_id AND owner_id = auth.uid() AND archived_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.cc_tasks
      WHERE id = task_id AND owner_id = auth.uid() AND archived_at IS NULL
    )
  );
CREATE POLICY cc_person_task_links_owner_update ON public.cc_person_task_links
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.cc_person_refs
      WHERE id = person_ref_id AND owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.cc_tasks
      WHERE id = task_id AND owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.cc_link_member_to_task(
  p_task_id UUID,
  p_member_id INTEGER,
  p_relationship_label TEXT DEFAULT '후속'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  owner UUID := auth.uid();
  member_display_name TEXT;
  person_ref UUID;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION '인증이 필요합니다.'; END IF;
  IF p_member_id IS NULL OR p_member_id <= 0 THEN RAISE EXCEPTION '연결할 사람을 선택해주세요.'; END IF;
  IF length(trim(COALESCE(p_relationship_label, ''))) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION '연결 이유는 1–40자로 입력해주세요.';
  END IF;

  PERFORM 1
  FROM public.cc_tasks
  WHERE id = p_task_id AND owner_id = owner AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION '연결할 내 업무를 찾을 수 없습니다.'; END IF;

  SELECT trim(concat_ws('', last_name, first_name))
  INTO member_display_name
  FROM public.members
  WHERE id = p_member_id AND status <> 'removed';
  IF NOT FOUND THEN RAISE EXCEPTION '사용 가능한 이음앱 멤버를 찾을 수 없습니다.'; END IF;

  INSERT INTO public.cc_person_refs(
    owner_id, external_system, external_person_id, display_name, last_verified_at, archived_at
  ) VALUES (
    owner, 'ium_app_members', p_member_id::TEXT, member_display_name, now(), NULL
  )
  ON CONFLICT(owner_id, external_system, external_person_id)
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    last_verified_at = now(),
    archived_at = NULL,
    updated_at = now()
  RETURNING id INTO person_ref;

  INSERT INTO public.cc_person_task_links(
    owner_id, person_ref_id, task_id, relationship_label, archived_at
  ) VALUES (
    owner, person_ref, p_task_id, trim(p_relationship_label), NULL
  )
  ON CONFLICT(owner_id, person_ref_id, task_id)
  DO UPDATE SET
    relationship_label = EXCLUDED.relationship_label,
    archived_at = NULL,
    updated_at = now();

  RETURN person_ref;
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_refresh_person_ref(p_person_ref_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  owner UUID := auth.uid();
  external_id TEXT;
  member_display_name TEXT;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION '인증이 필요합니다.'; END IF;

  SELECT external_person_id
  INTO external_id
  FROM public.cc_person_refs
  WHERE id = p_person_ref_id
    AND owner_id = owner
    AND external_system = 'ium_app_members'
    AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION '새로고침할 내 사람 연결을 찾을 수 없습니다.'; END IF;
  IF external_id !~ '^[0-9]+$' THEN RAISE EXCEPTION '이음앱 멤버 ID 형식이 아닙니다.'; END IF;

  SELECT trim(concat_ws('', last_name, first_name))
  INTO member_display_name
  FROM public.members
  WHERE id = external_id::INTEGER AND status <> 'removed';
  IF NOT FOUND THEN RAISE EXCEPTION '원본 멤버가 없거나 사용 중지 상태입니다.'; END IF;

  UPDATE public.cc_person_refs
  SET display_name = member_display_name,
      last_verified_at = now(),
      updated_at = now()
  WHERE id = p_person_ref_id AND owner_id = owner;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.cc_person_task_links TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_link_member_to_task(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_refresh_person_ref(UUID) TO authenticated;
