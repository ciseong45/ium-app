-- ============================================================
-- Phase 22: 운영 확장(예산·정산, 학기 전환 판단)
-- 원칙: 공식 장부를 대체하지 않고, 실제 승인·지급과 판단만 명시적으로 기록
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cc_ministry_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES public.cc_ministries(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'continue', 'paused', 'cancelled')),
  judgment TEXT NOT NULL CHECK (length(trim(judgment)) > 0),
  next_review_date DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cc_ministry_transitions_lookup_idx
  ON public.cc_ministry_transitions(owner_id, ministry_id, created_at DESC)
  WHERE archived_at IS NULL;

DROP TRIGGER IF EXISTS cc_ministry_transitions_touch_updated_at ON public.cc_ministry_transitions;
CREATE TRIGGER cc_ministry_transitions_touch_updated_at
  BEFORE UPDATE ON public.cc_ministry_transitions
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DROP TRIGGER IF EXISTS cc_ministry_transitions_audit ON public.cc_ministry_transitions;
CREATE TRIGGER cc_ministry_transitions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.cc_ministry_transitions
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit_change();

ALTER TABLE public.cc_ministry_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_ministry_transitions_owner_select ON public.cc_ministry_transitions;
DROP POLICY IF EXISTS cc_ministry_transitions_owner_insert ON public.cc_ministry_transitions;
DROP POLICY IF EXISTS cc_ministry_transitions_owner_update ON public.cc_ministry_transitions;
CREATE POLICY cc_ministry_transitions_owner_select ON public.cc_ministry_transitions
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY cc_ministry_transitions_owner_insert ON public.cc_ministry_transitions
  FOR INSERT TO authenticated WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.cc_ministries
      WHERE id = ministry_id AND owner_id = auth.uid()
    )
  );
CREATE POLICY cc_ministry_transitions_owner_update ON public.cc_ministry_transitions
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.cc_transition_cost(
  p_cost_id UUID,
  p_status TEXT,
  p_receipt_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  owner UUID := auth.uid();
  current_status TEXT;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION '인증이 필요합니다.'; END IF;
  IF p_status NOT IN ('planned', 'approval_pending', 'approved', 'paid', 'cancelled') THEN
    RAISE EXCEPTION '사용할 수 없는 비용 상태입니다.';
  END IF;

  SELECT status INTO current_status
  FROM public.cc_costs
  WHERE id = p_cost_id AND owner_id = owner AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '변경할 내 비용 기록을 찾을 수 없습니다.'; END IF;

  IF NOT (
    current_status = p_status
    OR (current_status = 'planned' AND p_status IN ('approval_pending', 'approved', 'cancelled'))
    OR (current_status = 'approval_pending' AND p_status IN ('approved', 'cancelled'))
    OR (current_status = 'approved' AND p_status IN ('paid', 'cancelled'))
  ) THEN
    RAISE EXCEPTION '현재 상태에서 해당 상태로 변경할 수 없습니다.';
  END IF;

  UPDATE public.cc_costs
  SET status = p_status,
      approved_at = CASE WHEN p_status IN ('approved', 'paid') THEN COALESCE(approved_at, now()) ELSE approved_at END,
      paid_at = CASE WHEN p_status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
      receipt_url = COALESCE(NULLIF(trim(COALESCE(p_receipt_url, '')), ''), receipt_url),
      updated_at = now()
  WHERE id = p_cost_id AND owner_id = owner;
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_record_ministry_transition(
  p_ministry_id UUID,
  p_outcome TEXT,
  p_judgment TEXT,
  p_next_review_date DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  owner UUID := auth.uid();
  transition_id UUID;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION '인증이 필요합니다.'; END IF;
  IF p_outcome NOT IN ('completed', 'continue', 'paused', 'cancelled') THEN
    RAISE EXCEPTION '사용할 수 없는 전환 판단입니다.';
  END IF;
  IF length(trim(COALESCE(p_judgment, ''))) = 0 THEN
    RAISE EXCEPTION '전환 판단 근거를 입력해주세요.';
  END IF;
  IF p_outcome IN ('continue', 'paused') AND p_next_review_date IS NULL THEN
    RAISE EXCEPTION '계속·보류 판단에는 다음 검토일이 필요합니다.';
  END IF;

  UPDATE public.cc_ministries
  SET status = CASE p_outcome
        WHEN 'completed' THEN 'completed'
        WHEN 'paused' THEN 'paused'
        WHEN 'cancelled' THEN 'cancelled'
        ELSE 'active'
      END,
      last_reviewed_at = now(),
      updated_at = now()
  WHERE id = p_ministry_id AND owner_id = owner AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION '전환할 내 사역을 찾을 수 없습니다.'; END IF;

  INSERT INTO public.cc_ministry_transitions(
    owner_id, ministry_id, outcome, judgment, next_review_date
  ) VALUES (
    owner, p_ministry_id, p_outcome, trim(p_judgment), p_next_review_date
  ) RETURNING id INTO transition_id;

  RETURN transition_id;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.cc_ministry_transitions TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_transition_cost(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_record_ministry_transition(UUID, TEXT, TEXT, DATE) TO authenticated;
