-- Requires summer-applications.sql and the current new-family workflow.
-- Read-only preflight, run separately before this migration:
-- SELECT g.season_id, gm.member_id, count(*) FROM public.small_group_members gm
-- JOIN public.small_groups g ON g.id=gm.group_id GROUP BY g.season_id, gm.member_id HAVING count(*)>1;
-- SELECT a.id FROM public.small_group_applications a JOIN public.small_groups g
-- ON g.id=a.assigned_group_id WHERE a.season_id<>g.season_id;
-- Both queries must return zero rows. Resolve exceptions manually; do not discard records.
BEGIN;

CREATE TABLE public.small_group_campaigns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season_id integer NOT NULL REFERENCES public.small_group_seasons(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  audience_description text NOT NULL DEFAULT '',
  intro text NOT NULL DEFAULT '',
  audience_mode text NOT NULL DEFAULT 'all' CHECK (audience_mode IN ('all','new_and_change')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','archived')),
  opens_at timestamptz,
  closes_at timestamptz,
  timezone text NOT NULL DEFAULT 'America/New_York',
  announcement_text text NOT NULL DEFAULT '',
  contact_text text NOT NULL DEFAULT '',
  notice_version integer NOT NULL DEFAULT 1,
  notice_text text NOT NULL DEFAULT '',
  retention_review_at date,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  UNIQUE(id, season_id),
  CHECK (length(audience_description)<=500 AND length(intro)<=2000
    AND length(announcement_text)<=1000 AND length(contact_text)<=500 AND length(notice_text)<=5000),
  CHECK (timezone='America/New_York'),
  CHECK (opens_at IS NULL OR closes_at IS NULL OR opens_at < closes_at),
  CHECK (status <> 'published' OR
    (opens_at IS NOT NULL AND closes_at IS NOT NULL AND length(trim(audience_description)) > 0
     AND length(trim(announcement_text)) > 0 AND length(trim(contact_text)) > 0
     AND length(trim(notice_text)) > 0 AND retention_review_at IS NOT NULL))
);

CREATE TABLE public.small_group_campaign_operators (
  campaign_id bigint NOT NULL REFERENCES public.small_group_campaigns(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(campaign_id, profile_id)
);

CREATE OR REPLACE FUNCTION public.small_group_can_manage(p_campaign bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND
    (p.role = 'admin' OR (p.role = 'upper_room_leader' AND EXISTS (
      SELECT 1 FROM public.small_group_campaign_operators o
      WHERE o.campaign_id = p_campaign AND o.profile_id = p.id
    )))
  );
$$;

CREATE OR REPLACE FUNCTION public.small_group_phone_key(p_phone text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE d text;
BEGIN
  d := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  IF p_phone IS NULL OR d = '' THEN RETURN NULL; END IF;
  IF left(p_phone,1) = '+' THEN RETURN '+' || d; END IF;
  IF length(d) IN (10,11) AND left(d,2) = '01' THEN RETURN '+82' || substring(d from 2); END IF;
  IF length(d) = 10 THEN RETURN '+1' || d; END IF;
  IF length(d) = 11 AND left(d,1) = '1' THEN RETURN '+' || d; END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.small_group_name_key(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT lower(regexp_replace(trim(coalesce(p_name,'')), '[[:space:]]+', '', 'g'));
$$;

ALTER TABLE public.small_group_applications
  ADD COLUMN campaign_id bigint,
  ADD COLUMN submission_key uuid,
  ADD COLUMN payload_hash text,
  ADD COLUMN application_kind text CHECK (application_kind IN ('new','continuing','change')),
  ADD COLUMN corrected_name text,
  ADD COLUMN corrected_phone text,
  ADD COLUMN corrected_note text,
  ADD COLUMN candidate_member_id integer REFERENCES public.members(id),
  ADD COLUMN match_status text CHECK (match_status IN ('exact_candidate','review_required','new_candidate','new_prepared','linked')),
  ADD COLUMN match_reason text,
  ADD COLUMN match_fingerprint text,
  ADD COLUMN matched_at timestamptz,
  ADD COLUMN prepared_member jsonb,
  ADD COLUMN proposed_group_id integer REFERENCES public.small_groups(id),
  ADD COLUMN consent_version integer,
  ADD COLUMN consented_at timestamptz,
  ADD COLUMN duplicate_of_id integer REFERENCES public.small_group_applications(id),
  ADD COLUMN confirmed_at timestamptz,
  ADD COLUMN confirmed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN informed_at timestamptz,
  ADD COLUMN informed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN informed_method text,
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN legacy_snapshot jsonb;

ALTER TABLE public.small_group_applications DROP CONSTRAINT IF EXISTS small_group_applications_status_check;
ALTER TABLE public.small_group_applications DROP CONSTRAINT IF EXISTS small_group_applications_source_check;
ALTER TABLE public.small_group_applications ADD CONSTRAINT small_group_application_source_check
  CHECK (source IN ('form','admin','legacy'));

INSERT INTO public.small_group_campaigns(season_id, slug, title, status, contact_text, notice_text)
SELECT id, 'legacy-season-' || id, name || ' 과거 신청', 'archived', '이음채플 담당자에게 문의해주세요.', '과거 신청 기록'
FROM public.small_group_seasons;

UPDATE public.small_group_applications a SET
  campaign_id = c.id,
  legacy_snapshot = jsonb_build_object('status', a.status, 'source', a.source,
    'assigned_group_id', a.assigned_group_id, 'member_id', a.member_id),
  status = CASE WHEN a.status = 'assigned' THEN 'legacy_review' ELSE a.status END,
  source = 'legacy',
  match_status = CASE WHEN a.member_id IS NOT NULL THEN 'linked' ELSE 'review_required' END
FROM public.small_group_campaigns c WHERE a.season_id = c.season_id AND c.slug = 'legacy-season-' || a.season_id;

ALTER TABLE public.small_group_applications ADD CONSTRAINT small_group_application_status_check
  CHECK (status IN ('pending','drafted','confirmed','cancelled','duplicate','legacy_review'));

ALTER TABLE public.small_group_applications ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE public.small_group_applications
  ADD CONSTRAINT application_campaign_season_fk FOREIGN KEY(campaign_id, season_id)
  REFERENCES public.small_group_campaigns(id, season_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX application_submission_unique ON public.small_group_applications(campaign_id, submission_key) WHERE submission_key IS NOT NULL;
CREATE UNIQUE INDEX application_member_unique ON public.small_group_applications(campaign_id, member_id)
  WHERE member_id IS NOT NULL AND status IN ('pending','drafted','confirmed');
CREATE INDEX application_worklist ON public.small_group_applications(campaign_id, status, applied_at, id);
CREATE INDEX application_candidate ON public.small_group_applications(candidate_member_id);

ALTER TABLE public.small_groups ADD CONSTRAINT small_groups_id_season_unique UNIQUE(id, season_id);
ALTER TABLE public.small_group_applications
  ADD CONSTRAINT proposed_group_season_fk FOREIGN KEY(proposed_group_id, season_id) REFERENCES public.small_groups(id, season_id),
  ADD CONSTRAINT assigned_group_season_fk FOREIGN KEY(assigned_group_id, season_id) REFERENCES public.small_groups(id, season_id),
  ADD CONSTRAINT drafted_has_group CHECK (status <> 'drafted' OR proposed_group_id IS NOT NULL),
  ADD CONSTRAINT confirmed_has_member CHECK (status <> 'confirmed' OR
    (member_id IS NOT NULL AND assigned_group_id IS NOT NULL AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL));

ALTER TABLE public.small_group_members
  ADD COLUMN season_id integer,
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_by uuid REFERENCES public.profiles(id);
UPDATE public.small_group_members gm SET season_id = g.season_id FROM public.small_groups g WHERE gm.group_id = g.id;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.small_group_members GROUP BY season_id, member_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION '같은 학기에 두 순에 속한 성도가 있습니다. 명단을 검토한 뒤 적용하세요.';
  END IF;
END $$;
ALTER TABLE public.small_group_members ALTER COLUMN season_id SET NOT NULL;
ALTER TABLE public.small_group_members
  ADD CONSTRAINT membership_one_group_per_season UNIQUE(season_id, member_id),
  ADD CONSTRAINT membership_group_season_fk FOREIGN KEY(group_id, season_id) REFERENCES public.small_groups(id, season_id);

CREATE OR REPLACE FUNCTION public.small_group_membership_season() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  SELECT season_id INTO NEW.season_id FROM public.small_groups WHERE id = NEW.group_id;
  IF NEW.season_id IS NULL THEN RAISE EXCEPTION '순을 찾을 수 없습니다.'; END IF;
  IF TG_OP = 'UPDATE' THEN NEW.version := OLD.version + 1; NEW.updated_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER membership_season_guard BEFORE INSERT OR UPDATE OF group_id ON public.small_group_members
  FOR EACH ROW EXECUTE FUNCTION public.small_group_membership_season();

-- New-family intake and assignment confirmation must acquire the same season lock.
CREATE OR REPLACE FUNCTION public.assign_new_family_group() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sid integer; gid integer; rid bigint;
BEGIN
  SELECT id INTO sid FROM public.small_group_seasons WHERE is_active ORDER BY id DESC LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION '활성 학기를 먼저 설정해주세요.'; END IF;
  PERFORM pg_advisory_xact_lock(260922, sid);
  SELECT id INTO gid FROM public.small_groups WHERE season_id=sid AND name='새가족순' ORDER BY id LIMIT 1;
  IF gid IS NULL THEN
    SELECT id INTO rid FROM public.upper_rooms WHERE season_id=sid AND name='새가족' ORDER BY id LIMIT 1;
    IF rid IS NULL THEN
      INSERT INTO public.upper_rooms(season_id,name) VALUES(sid,'새가족') RETURNING id INTO rid;
    END IF;
    INSERT INTO public.small_groups(season_id,upper_room_id,name)
      VALUES(sid,rid,'새가족순') RETURNING id INTO gid;
  END IF;
  INSERT INTO public.small_group_members(group_id,member_id,season_id)
    VALUES(gid,NEW.member_id,sid) ON CONFLICT (season_id,member_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TABLE public.small_group_operations (
  operation_id uuid PRIMARY KEY,
  campaign_id bigint NOT NULL REFERENCES public.small_group_campaigns(id),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  payload_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.small_group_operation_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operation_id uuid,
  campaign_id bigint REFERENCES public.small_group_campaigns(id),
  application_id integer REFERENCES public.small_group_applications(id),
  season_id integer REFERENCES public.small_group_seasons(id),
  member_id integer REFERENCES public.members(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.small_group_request_windows (
  client_key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL,
  PRIMARY KEY(client_key, window_start)
);

CREATE OR REPLACE FUNCTION public.log_group_membership_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target public.small_group_members%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN target := OLD; ELSE target := NEW; END IF;
  INSERT INTO public.small_group_operation_log(season_id,member_id,actor_id,action,before_value,after_value)
    VALUES(target.season_id,target.member_id,auth.uid(),
      CASE WHEN TG_OP='INSERT' THEN 'roster_add' WHEN TG_OP='DELETE' THEN 'roster_remove' ELSE 'roster_move' END,
      CASE WHEN TG_OP='INSERT' THEN NULL ELSE jsonb_build_object('group_id',OLD.group_id,'member_id',target.member_id) END,
      CASE WHEN TG_OP='DELETE' THEN NULL ELSE jsonb_build_object('group_id',NEW.group_id,'member_id',target.member_id) END);
  RETURN NULL;
END $$;
CREATE TRIGGER log_group_membership AFTER INSERT OR UPDATE OF group_id OR DELETE ON public.small_group_members
  FOR EACH ROW EXECUTE FUNCTION public.log_group_membership_change();

CREATE OR REPLACE FUNCTION public.guard_group_campaign() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.status <> 'draft' AND NEW.slug <> OLD.slug THEN RAISE EXCEPTION 'PUBLISHED_SLUG_IMMUTABLE'; END IF;
  IF NEW.season_id <> OLD.season_id AND EXISTS
    (SELECT 1 FROM public.small_group_applications WHERE campaign_id=OLD.id) THEN
    RAISE EXCEPTION 'CAMPAIGN_SEASON_IMMUTABLE'; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
  IF NEW.notice_text IS DISTINCT FROM OLD.notice_text THEN NEW.notice_version := OLD.notice_version + 1; END IF;
  NEW.updated_at := now();
  INSERT INTO public.small_group_operation_log(campaign_id,season_id,actor_id,action,before_value,after_value)
    VALUES(OLD.id,OLD.season_id,auth.uid(),'campaign_update',
      jsonb_build_object('status',OLD.status,'opens_at',OLD.opens_at,'closes_at',OLD.closes_at,'notice_version',OLD.notice_version),
      jsonb_build_object('status',NEW.status,'opens_at',NEW.opens_at,'closes_at',NEW.closes_at,'notice_version',NEW.notice_version));
  RETURN NEW;
END $$;
CREATE TRIGGER guard_group_campaign_update BEFORE UPDATE ON public.small_group_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.guard_group_campaign();

CREATE OR REPLACE FUNCTION public.receive_group_application(
  p_slug text, p_key uuid, p_name text, p_phone text, p_kind text,
  p_note text, p_notice_version integer, p_payload_hash text, p_client_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.small_group_campaigns%ROWTYPE; old_hash text; ids integer[]; mid integer;
  ms text; reason text; bucket timestamptz; requests integer;
BEGIN
  SELECT * INTO c FROM public.small_group_campaigns WHERE slug = p_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'CAMPAIGN_NOT_OPEN'; END IF;
  SELECT payload_hash INTO old_hash FROM public.small_group_applications
    WHERE campaign_id = c.id AND submission_key = p_key;
  IF FOUND THEN
    IF old_hash <> p_payload_hash THEN RAISE EXCEPTION 'SUBMISSION_KEY_CONFLICT'; END IF;
    RETURN;
  END IF;
  IF c.status <> 'published' OR now() < c.opens_at OR now() >= c.closes_at THEN
    RAISE EXCEPTION 'CAMPAIGN_NOT_OPEN';
  END IF;
  IF p_key IS NULL OR p_payload_hash IS NULL OR length(p_payload_hash) <> 64
    OR length(trim(coalesce(p_name,''))) NOT BETWEEN 1 AND 80
    OR coalesce(p_phone,'') !~ '^\+[1-9][0-9]{7,14}$' OR length(coalesce(p_note,'')) > 500
    OR p_kind IS NULL OR p_kind NOT IN ('new','continuing','change')
    OR (c.audience_mode = 'new_and_change' AND p_kind = 'continuing') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR';
  END IF;
  IF p_notice_version IS DISTINCT FROM c.notice_version THEN RAISE EXCEPTION 'NOTICE_CHANGED'; END IF;
  IF length(coalesce(p_client_key,'')) <> 64 THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  bucket := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
  DELETE FROM public.small_group_request_windows WHERE window_start < now() - interval '2 days';
  INSERT INTO public.small_group_request_windows(client_key, window_start, count)
    VALUES (p_client_key, bucket, 1)
    ON CONFLICT(client_key, window_start) DO UPDATE SET count = small_group_request_windows.count + 1
    RETURNING count INTO requests;
  IF requests > 30 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  SELECT array_agg(m.id ORDER BY m.id) INTO ids FROM public.members m
    WHERE public.small_group_name_key(m.last_name || m.first_name) = public.small_group_name_key(p_name)
      AND public.small_group_phone_key(m.phone) = p_phone;
  IF coalesce(array_length(ids,1),0) = 1 THEN
    mid := ids[1]; ms := 'exact_candidate'; reason := 'exact_name_phone';
    IF EXISTS (SELECT 1 FROM public.small_group_applications a
      WHERE a.campaign_id = c.id AND a.status IN ('pending','drafted','confirmed')
        AND (a.member_id = mid OR a.candidate_member_id = mid)) THEN
      ms := 'review_required'; reason := 'possible_duplicate'; mid := NULL;
    ELSIF EXISTS (SELECT 1 FROM public.members m WHERE m.id = mid AND m.status IN ('removed','on_leave')) THEN
      ms := 'review_required'; reason := 'member_status'; mid := NULL;
    END IF;
  ELSIF coalesce(array_length(ids,1),0) > 1 THEN
    ms := 'review_required'; reason := 'multiple_candidates';
  ELSE
    IF EXISTS (SELECT 1 FROM public.members m WHERE
      public.small_group_name_key(m.last_name || m.first_name)=public.small_group_name_key(p_name)
      OR public.small_group_phone_key(m.phone)=p_phone) THEN
      ms := 'review_required'; reason := 'partial_match';
    ELSE ms := 'new_candidate'; reason := 'no_candidate'; END IF;
  END IF;
  INSERT INTO public.small_group_applications
    (campaign_id, season_id, submission_key, payload_hash, name, phone, note, application_kind,
     source, status, candidate_member_id, match_status, match_reason, matched_at, consent_version, consented_at)
  VALUES (c.id, c.season_id, p_key, p_payload_hash, trim(p_name), p_phone, nullif(trim(coalesce(p_note,'')),''),
    p_kind, 'form', 'pending', mid, ms, reason, now(), p_notice_version, now());
END $$;

CREATE OR REPLACE FUNCTION public.draft_group_application(
  p_id integer, p_version integer, p_group_id integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.small_group_applications%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.small_group_applications WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.small_group_can_manage(a.campaign_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF a.version <> p_version OR a.status NOT IN ('pending','drafted') THEN RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
  IF p_group_id IS NOT NULL AND NOT EXISTS
     (SELECT 1 FROM public.small_groups WHERE id=p_group_id AND season_id=a.season_id) THEN
    RAISE EXCEPTION 'GROUP_SEASON_MISMATCH'; END IF;
  UPDATE public.small_group_applications SET proposed_group_id=p_group_id,
    status=CASE WHEN p_group_id IS NULL THEN 'pending' ELSE 'drafted' END,
    version=version+1, updated_at=now() WHERE id=p_id;
  INSERT INTO public.small_group_operation_log(campaign_id, application_id, season_id, actor_id, action, after_value)
    VALUES(a.campaign_id,a.id,a.season_id,auth.uid(),'draft',jsonb_build_object('group_id',p_group_id));
END $$;

CREATE OR REPLACE FUNCTION public.correct_group_application(
  p_id integer, p_version integer, p_name text, p_phone text, p_note text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.small_group_applications%ROWTYPE; ids integer[]; mid integer; ms text; reason_code text;
  effective_name text; effective_note text;
BEGIN
  SELECT * INTO a FROM public.small_group_applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.small_group_can_manage(a.campaign_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF a.version<>p_version OR a.status NOT IN ('pending','drafted') THEN RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
  effective_name := trim(coalesce(p_name,''));
  effective_note := trim(coalesce(p_note,''));
  IF length(effective_name) NOT BETWEEN 1 AND 80 OR coalesce(p_phone,'') !~ '^\+[1-9][0-9]{7,14}$'
    OR length(effective_note)>500 OR length(trim(coalesce(p_reason,'')))<3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  IF effective_name=coalesce(a.corrected_name,a.name)
    AND p_phone=coalesce(a.corrected_phone,a.phone)
    AND effective_note=coalesce(a.corrected_note,a.note,'') THEN RETURN; END IF;
  SELECT array_agg(m.id ORDER BY m.id) INTO ids FROM public.members m
    WHERE public.small_group_name_key(m.last_name || m.first_name)=public.small_group_name_key(effective_name)
      AND public.small_group_phone_key(m.phone)=p_phone;
  IF coalesce(array_length(ids,1),0)=1 THEN
    mid := ids[1]; ms := 'exact_candidate'; reason_code := 'corrected_exact_name_phone';
    IF EXISTS (SELECT 1 FROM public.small_group_applications b
      WHERE b.campaign_id=a.campaign_id AND b.id<>a.id AND b.status IN ('pending','drafted','confirmed')
        AND (b.member_id=mid OR b.candidate_member_id=mid)) THEN
      mid := NULL; ms := 'review_required'; reason_code := 'possible_duplicate';
    ELSIF EXISTS (SELECT 1 FROM public.members m WHERE m.id=mid AND m.status IN ('removed','on_leave')) THEN
      mid := NULL; ms := 'review_required'; reason_code := 'member_status';
    END IF;
  ELSIF coalesce(array_length(ids,1),0)>1 THEN
    ms := 'review_required'; reason_code := 'multiple_candidates';
  ELSIF EXISTS (SELECT 1 FROM public.members m WHERE
    public.small_group_name_key(m.last_name || m.first_name)=public.small_group_name_key(effective_name)
      OR public.small_group_phone_key(m.phone)=p_phone) THEN
    ms := 'review_required'; reason_code := 'partial_match';
  ELSE
    ms := 'new_candidate'; reason_code := 'no_candidate';
  END IF;
  UPDATE public.small_group_applications SET
    corrected_name=NULLIF(effective_name,a.name), corrected_phone=NULLIF(p_phone,a.phone),
    corrected_note=CASE WHEN effective_note=coalesce(a.note,'') THEN NULL ELSE effective_note END,
    member_id=NULL,candidate_member_id=mid,prepared_member=NULL,
    match_status=ms,match_reason=reason_code,matched_at=now(),version=version+1,updated_at=now()
    WHERE id=a.id;
  INSERT INTO public.small_group_operation_log(campaign_id,application_id,season_id,actor_id,action,
    before_value,after_value,reason)
    VALUES(a.campaign_id,a.id,a.season_id,auth.uid(),'correct',
      jsonb_build_object('name',coalesce(a.corrected_name,a.name),'phone',coalesce(a.corrected_phone,a.phone),
        'note',coalesce(a.corrected_note,a.note)),
      jsonb_build_object('name',effective_name,'phone',p_phone,'note',effective_note,'match_status',ms),p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.resolve_group_application(
  p_id integer, p_version integer, p_member_id integer, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.small_group_applications%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.small_group_applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.small_group_can_manage(a.campaign_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF a.version <> p_version OR a.status NOT IN ('pending','drafted') THEN RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
  IF length(trim(coalesce(p_reason,''))) < 3 OR NOT EXISTS (SELECT 1 FROM public.members WHERE id=p_member_id) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  IF EXISTS (SELECT 1 FROM public.small_group_applications b WHERE b.campaign_id=a.campaign_id
    AND b.member_id=p_member_id AND b.status IN ('pending','drafted','confirmed') AND b.id<>p_id) THEN
    RAISE EXCEPTION 'DUPLICATE_REVIEW_REQUIRED'; END IF;
  UPDATE public.small_group_applications SET member_id=p_member_id, candidate_member_id=NULL,
    match_status='linked', match_reason='manual', version=version+1, updated_at=now() WHERE id=p_id;
  INSERT INTO public.small_group_operation_log(campaign_id,application_id,season_id,member_id,actor_id,action,reason)
    VALUES(a.campaign_id,a.id,a.season_id,p_member_id,auth.uid(),'resolve',p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.prepare_new_group_member(
  p_id integer, p_version integer, p_last_name text, p_first_name text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.small_group_applications%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.small_group_applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.small_group_can_manage(a.campaign_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF a.version <> p_version OR a.status NOT IN ('pending','drafted') THEN RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
  IF length(trim(coalesce(p_last_name,''))) NOT BETWEEN 1 AND 40
    OR length(trim(coalesce(p_first_name,''))) NOT BETWEEN 1 AND 40
    OR length(trim(coalesce(p_reason,''))) < 3 THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  IF EXISTS (SELECT 1 FROM public.members m WHERE
    public.small_group_name_key(m.last_name || m.first_name)=
      public.small_group_name_key(p_last_name || p_first_name)
    AND public.small_group_phone_key(m.phone)=coalesce(a.corrected_phone,a.phone)) THEN RAISE EXCEPTION 'MATCH_CHANGED'; END IF;
  UPDATE public.small_group_applications SET match_status='new_prepared',candidate_member_id=NULL,
    prepared_member=jsonb_build_object('last_name',trim(p_last_name),'first_name',trim(p_first_name)),
    version=version+1,updated_at=now() WHERE id=p_id;
  INSERT INTO public.small_group_operation_log(campaign_id,application_id,season_id,actor_id,action,reason)
    VALUES(a.campaign_id,a.id,a.season_id,auth.uid(),'prepare_new',p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_group_application(p_id integer,p_version integer,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.small_group_applications%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.small_group_applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.small_group_can_manage(a.campaign_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF a.version<>p_version OR a.status NOT IN ('pending','drafted') THEN RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
  IF length(trim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  UPDATE public.small_group_applications SET status='cancelled',proposed_group_id=NULL,version=version+1,updated_at=now() WHERE id=p_id;
  INSERT INTO public.small_group_operation_log(campaign_id,application_id,season_id,member_id,actor_id,action,reason)
    VALUES(a.campaign_id,a.id,a.season_id,a.member_id,auth.uid(),'cancel',p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.duplicate_group_application(p_id integer,p_version integer,p_representative_id integer,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.small_group_applications%ROWTYPE; representative public.small_group_applications%ROWTYPE;
BEGIN
  IF p_id=p_representative_id THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  SELECT * INTO a FROM public.small_group_applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.small_group_can_manage(a.campaign_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO representative FROM public.small_group_applications WHERE id=p_representative_id FOR UPDATE;
  IF NOT FOUND OR representative.campaign_id<>a.campaign_id OR representative.status IN ('cancelled','duplicate','legacy_review')
    OR a.status NOT IN ('pending','drafted') OR a.version<>p_version OR length(trim(coalesce(p_reason,'')))<3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  UPDATE public.small_group_applications SET status='duplicate',duplicate_of_id=p_representative_id,
    proposed_group_id=NULL,version=version+1,updated_at=now() WHERE id=p_id;
  INSERT INTO public.small_group_operation_log(campaign_id,application_id,season_id,member_id,actor_id,action,reason,after_value)
    VALUES(a.campaign_id,a.id,a.season_id,a.member_id,auth.uid(),'duplicate',p_reason,
      jsonb_build_object('representative_id',p_representative_id));
END $$;

CREATE OR REPLACE FUNCTION public.mark_group_informed(p_id integer,p_version integer,p_method text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.small_group_applications%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.small_group_applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.small_group_can_manage(a.campaign_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF a.version<>p_version OR a.status<>'confirmed' THEN RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
  IF p_method NOT IN ('direct','phone','message','other') THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  UPDATE public.small_group_applications SET informed_at=now(),informed_by=auth.uid(),
    informed_method=p_method,version=version+1,updated_at=now() WHERE id=p_id;
  INSERT INTO public.small_group_operation_log(campaign_id,application_id,season_id,member_id,actor_id,action,after_value)
    VALUES(a.campaign_id,a.id,a.season_id,a.member_id,auth.uid(),'informed',jsonb_build_object('method',p_method));
END $$;

CREATE OR REPLACE FUNCTION public.set_group_campaign_operators(p_campaign_id bigint,p_profile_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sid integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin') THEN
    RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT season_id INTO sid FROM public.small_group_campaigns WHERE id=p_campaign_id FOR UPDATE;
  IF sid IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_profile_ids,ARRAY[]::uuid[])) id
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=id AND p.role='upper_room_leader')) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  DELETE FROM public.small_group_campaign_operators WHERE campaign_id=p_campaign_id;
  INSERT INTO public.small_group_campaign_operators(campaign_id,profile_id,assigned_by)
    SELECT p_campaign_id,id,auth.uid() FROM (SELECT DISTINCT unnest(coalesce(p_profile_ids,ARRAY[]::uuid[])) AS id) x;
  INSERT INTO public.small_group_operation_log(campaign_id,season_id,actor_id,action,after_value)
    VALUES(p_campaign_id,sid,auth.uid(),'operators_update',jsonb_build_object('profile_ids',p_profile_ids));
END $$;

CREATE OR REPLACE FUNCTION public.set_group_member(
  p_season_id integer,p_member_id integer,p_group_id integer,p_expected_group_id integer,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_group integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','upper_room_leader')) THEN
    RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF length(trim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  IF p_group_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.small_groups g WHERE g.id=p_group_id AND g.season_id=p_season_id) THEN
    RAISE EXCEPTION 'GROUP_SEASON_MISMATCH'; END IF;
  PERFORM pg_advisory_xact_lock(260922,p_season_id);
  SELECT group_id INTO current_group FROM public.small_group_members
    WHERE season_id=p_season_id AND member_id=p_member_id FOR UPDATE;
  IF current_group IS DISTINCT FROM p_expected_group_id THEN RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
  IF p_group_id IS NULL THEN
    DELETE FROM public.small_group_members WHERE season_id=p_season_id AND member_id=p_member_id;
  ELSIF current_group IS NULL THEN
    INSERT INTO public.small_group_members(group_id,member_id,season_id,updated_by)
      VALUES(p_group_id,p_member_id,p_season_id,auth.uid());
  ELSIF current_group<>p_group_id THEN
    UPDATE public.small_group_members SET group_id=p_group_id,updated_by=auth.uid()
      WHERE season_id=p_season_id AND member_id=p_member_id;
  END IF;
  INSERT INTO public.small_group_operation_log(season_id,member_id,actor_id,action,before_value,after_value,reason)
    VALUES(p_season_id,p_member_id,auth.uid(),'roster_set',jsonb_build_object('group_id',current_group),
      jsonb_build_object('group_id',p_group_id),p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_group_application(
  p_id integer,p_version integer,p_expected_group_id integer,p_target_group_id integer,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.small_group_applications%ROWTYPE; current_group integer;
BEGIN
  SELECT * INTO a FROM public.small_group_applications WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  PERFORM pg_advisory_xact_lock(260922,a.season_id);
  SELECT * INTO a FROM public.small_group_applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.small_group_can_manage(a.campaign_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF a.version<>p_version OR a.status<>'confirmed' OR length(trim(coalesce(p_reason,'')))<3 THEN
    RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
  SELECT group_id INTO current_group FROM public.small_group_members
    WHERE season_id=a.season_id AND member_id=a.member_id FOR UPDATE;
  IF current_group IS DISTINCT FROM p_expected_group_id OR current_group IS DISTINCT FROM a.assigned_group_id THEN
    RAISE EXCEPTION 'ALREADY_CHANGED'; END IF;
  IF p_target_group_id IS NOT NULL AND (p_target_group_id=current_group OR NOT EXISTS
    (SELECT 1 FROM public.small_groups WHERE id=p_target_group_id AND season_id=a.season_id)) THEN
    RAISE EXCEPTION 'GROUP_SEASON_MISMATCH'; END IF;
  IF p_target_group_id IS NULL THEN
    DELETE FROM public.small_group_members WHERE season_id=a.season_id AND member_id=a.member_id;
  ELSE
    UPDATE public.small_group_members SET group_id=p_target_group_id,updated_by=auth.uid()
      WHERE season_id=a.season_id AND member_id=a.member_id;
  END IF;
  UPDATE public.small_group_applications SET status='cancelled',version=version+1,updated_at=now() WHERE id=a.id;
  INSERT INTO public.small_group_operation_log(campaign_id,application_id,season_id,member_id,actor_id,action,
    before_value,after_value,reason)
    VALUES(a.campaign_id,a.id,a.season_id,a.member_id,auth.uid(),'revoke_confirmed',
      jsonb_build_object('group_id',current_group),jsonb_build_object('group_id',p_target_group_id),p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.set_group_members_bulk(
  p_season_id integer,p_member_ids integer[],p_target_group_id integer,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE mid integer; current_group integer;
BEGIN
  IF p_member_ids IS NULL OR array_length(p_member_ids,1) NOT BETWEEN 1 AND 100
    OR (SELECT count(DISTINCT x) FROM unnest(p_member_ids) x)<>array_length(p_member_ids,1) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  PERFORM pg_advisory_xact_lock(260922,p_season_id);
  FOR mid IN SELECT unnest(p_member_ids) ORDER BY 1 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.members WHERE id=mid) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    SELECT group_id INTO current_group FROM public.small_group_members
      WHERE season_id=p_season_id AND member_id=mid FOR UPDATE;
    PERFORM public.set_group_member(p_season_id,mid,p_target_group_id,current_group,p_reason);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_group_applications(
  p_campaign_id bigint, p_operation_id uuid, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.small_group_campaigns%ROWTYPE; item jsonb; a public.small_group_applications%ROWTYPE;
  mid integer; old_group integer; result jsonb := '[]'::jsonb; prior public.small_group_operations%ROWTYPE;
  request_hash text; wanted_id integer; wanted_version integer;
BEGIN
  IF NOT public.small_group_can_manage(p_campaign_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_operation_id IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  SELECT * INTO c FROM public.small_group_campaigns WHERE id=p_campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  request_hash := md5(p_campaign_id::text || p_items::text);
  SELECT * INTO prior FROM public.small_group_operations WHERE operation_id=p_operation_id FOR UPDATE;
  IF FOUND THEN
    IF prior.actor_id <> auth.uid() OR prior.payload_hash <> request_hash THEN RAISE EXCEPTION 'SUBMISSION_KEY_CONFLICT'; END IF;
    RETURN prior.result;
  END IF;
  PERFORM pg_advisory_xact_lock(260922, c.season_id);
  IF (SELECT count(DISTINCT (j->>'id')::integer) FROM jsonb_array_elements(p_items) j) <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY (value->>'id')::integer LOOP
    wanted_id := (item->>'id')::integer; wanted_version := (item->>'version')::integer;
    SELECT * INTO a FROM public.small_group_applications WHERE id=wanted_id FOR UPDATE;
    IF NOT FOUND OR a.campaign_id<>c.id OR a.status<>'drafted' OR a.version<>wanted_version THEN
      RAISE EXCEPTION 'VERSION_CONFLICT'; END IF;
    IF a.proposed_group_id IS NULL OR NOT EXISTS
      (SELECT 1 FROM public.small_groups WHERE id=a.proposed_group_id AND season_id=c.season_id) THEN
      RAISE EXCEPTION 'GROUP_SEASON_MISMATCH'; END IF;
    mid := a.member_id;
    IF mid IS NULL AND a.match_status='exact_candidate' AND a.candidate_member_id IS NOT NULL THEN
      SELECT m.id INTO mid FROM public.members m WHERE m.id=a.candidate_member_id
        AND public.small_group_name_key(m.last_name || m.first_name)=public.small_group_name_key(coalesce(a.corrected_name,a.name))
        AND public.small_group_phone_key(m.phone)=coalesce(a.corrected_phone,a.phone)
        AND m.status NOT IN ('removed','on_leave') FOR UPDATE;
      IF mid IS NULL THEN RAISE EXCEPTION 'MATCH_CHANGED'; END IF;
      IF EXISTS (SELECT 1 FROM public.small_group_applications b WHERE b.campaign_id=c.id AND b.id<>a.id
        AND b.status IN ('pending','drafted','confirmed') AND (b.member_id=mid OR b.candidate_member_id=mid)) THEN
        RAISE EXCEPTION 'DUPLICATE_REVIEW_REQUIRED'; END IF;
    END IF;
    IF mid IS NULL AND a.match_status='new_prepared' AND a.prepared_member IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.members m WHERE
        public.small_group_name_key(m.last_name || m.first_name) =
          public.small_group_name_key((a.prepared_member->>'last_name') || (a.prepared_member->>'first_name'))
        AND public.small_group_phone_key(m.phone)=coalesce(a.corrected_phone,a.phone)) THEN
        RAISE EXCEPTION 'MATCH_CHANGED';
      END IF;
      INSERT INTO public.members(last_name,first_name,phone,status)
        VALUES(a.prepared_member->>'last_name',a.prepared_member->>'first_name',coalesce(a.corrected_phone,a.phone),'visitor')
        RETURNING id INTO mid;
    END IF;
    IF mid IS NULL THEN RAISE EXCEPTION 'MATCH_REVIEW_REQUIRED'; END IF;
    IF EXISTS (SELECT 1 FROM public.small_group_applications b WHERE b.campaign_id=c.id AND b.id<>a.id
      AND b.status IN ('pending','drafted','confirmed') AND b.member_id=mid) THEN
      RAISE EXCEPTION 'DUPLICATE_REVIEW_REQUIRED'; END IF;
    SELECT group_id INTO old_group FROM public.small_group_members
      WHERE season_id=c.season_id AND member_id=mid FOR UPDATE;
    IF old_group IS NULL THEN
      INSERT INTO public.small_group_members(group_id, member_id, season_id, updated_by)
        VALUES(a.proposed_group_id,mid,c.season_id,auth.uid());
    ELSIF old_group <> a.proposed_group_id THEN
      UPDATE public.small_group_members SET group_id=a.proposed_group_id,updated_by=auth.uid()
        WHERE season_id=c.season_id AND member_id=mid;
    END IF;
    UPDATE public.small_group_applications SET member_id=mid, status='confirmed', match_status='linked',
      assigned_group_id=a.proposed_group_id, confirmed_at=now(),confirmed_by=auth.uid(),
      version=version+1,updated_at=now() WHERE id=a.id;
    INSERT INTO public.small_group_operation_log(operation_id,campaign_id,application_id,season_id,member_id,
      actor_id,action,before_value,after_value)
      VALUES(p_operation_id,c.id,a.id,c.season_id,mid,auth.uid(),'confirm',
        jsonb_build_object('group_id',old_group),jsonb_build_object('group_id',a.proposed_group_id));
    result := result || jsonb_build_object('application_id',a.id,'member_id',mid,'group_id',a.proposed_group_id);
  END LOOP;
  INSERT INTO public.small_group_operations(operation_id,campaign_id,actor_id,payload_hash,result)
    VALUES(p_operation_id,c.id,auth.uid(),request_hash,result);
  RETURN result;
END $$;

ALTER TABLE public.small_group_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.small_group_campaign_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.small_group_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.small_group_operation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.small_group_request_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_public_read ON public.small_group_campaigns FOR SELECT TO anon, authenticated
  USING (status IN ('published','paused','archived'));
CREATE POLICY campaign_admin_read ON public.small_group_campaigns FOR SELECT TO authenticated
  USING (public.small_group_can_manage(id));
CREATE POLICY campaign_admin_write ON public.small_group_campaigns FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'))
  WITH CHECK (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
CREATE POLICY campaign_operator_read ON public.small_group_campaign_operators FOR SELECT TO authenticated
  USING (public.small_group_can_manage(campaign_id));
CREATE POLICY campaign_operator_write ON public.small_group_campaign_operators FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'))
  WITH CHECK (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));

DROP POLICY IF EXISTS applications_anon_insert ON public.small_group_applications;
DROP POLICY IF EXISTS applications_select ON public.small_group_applications;
DROP POLICY IF EXISTS applications_insert ON public.small_group_applications;
DROP POLICY IF EXISTS applications_update ON public.small_group_applications;
DROP POLICY IF EXISTS applications_delete ON public.small_group_applications;
CREATE POLICY application_operator_read ON public.small_group_applications FOR SELECT TO authenticated
  USING (public.small_group_can_manage(campaign_id));
DROP POLICY IF EXISTS group_members_select ON public.small_group_members;
DROP POLICY IF EXISTS group_members_insert ON public.small_group_members;
DROP POLICY IF EXISTS group_members_update ON public.small_group_members;
DROP POLICY IF EXISTS group_members_delete ON public.small_group_members;
DROP POLICY IF EXISTS small_group_members_auth_select ON public.small_group_members;
DROP POLICY IF EXISTS small_group_members_auth_insert ON public.small_group_members;
DROP POLICY IF EXISTS small_group_members_auth_update ON public.small_group_members;
DROP POLICY IF EXISTS small_group_members_auth_delete ON public.small_group_members;
CREATE POLICY group_members_select_scoped ON public.small_group_members FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND
    (p.role IN ('admin','upper_room_leader') OR (p.role='group_leader' AND EXISTS
      (SELECT 1 FROM public.small_groups g WHERE g.id=group_id AND g.leader_id=p.linked_member_id)))));
CREATE POLICY group_members_write_scoped ON public.small_group_members FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','upper_room_leader')))
  WITH CHECK (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','upper_room_leader')));
CREATE POLICY operation_log_manager_read ON public.small_group_operation_log FOR SELECT TO authenticated
  USING (campaign_id IS NOT NULL AND public.small_group_can_manage(campaign_id));
CREATE POLICY operation_log_admin_read ON public.small_group_operation_log FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin'));

CREATE OR REPLACE FUNCTION public.protect_group_profile_privileges() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.linked_member_id IS DISTINCT FROM OLD.linked_member_id)
    AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_group_profile_privileges BEFORE UPDATE OF role,linked_member_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_group_profile_privileges();

REVOKE ALL ON public.small_group_campaigns FROM anon, authenticated;
GRANT SELECT(slug,title,intro,audience_description,audience_mode,status,opens_at,closes_at,
  timezone,announcement_text,contact_text,notice_version,notice_text,id,season_id,version)
  ON public.small_group_campaigns TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.small_group_campaigns TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.small_group_campaigns_id_seq TO authenticated;
REVOKE ALL ON public.small_group_campaign_operators FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.small_group_campaign_operators TO authenticated;
REVOKE ALL ON public.small_group_applications FROM anon, authenticated;
GRANT SELECT ON public.small_group_applications TO authenticated;
REVOKE ALL ON public.small_group_request_windows, public.small_group_operations, public.small_group_operation_log
  FROM anon, authenticated;
GRANT SELECT ON public.small_group_operation_log TO authenticated;
GRANT ALL ON public.small_group_campaigns, public.small_group_campaign_operators,
  public.small_group_applications, public.small_group_operations, public.small_group_operation_log,
  public.small_group_request_windows, public.small_group_members TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.small_group_campaigns_id_seq,
  public.small_group_operation_log_id_seq TO service_role;
REVOKE ALL ON FUNCTION public.receive_group_application(text,uuid,text,text,text,text,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receive_group_application(text,uuid,text,text,text,text,integer,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.draft_group_application(integer,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_group_application(integer,integer,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_group_application(integer,integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prepare_new_group_member(integer,integer,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_group_application(integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.duplicate_group_application(integer,integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_group_informed(integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_group_campaign_operators(bigint,uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_group_member(integer,integer,integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_group_application(integer,integer,integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_group_members_bulk(integer,integer[],integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_group_applications(bigint,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draft_group_application(integer,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.correct_group_application(integer,integer,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_group_application(integer,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_new_group_member(integer,integer,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_group_application(integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_group_application(integer,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_group_informed(integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_group_campaign_operators(bigint,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_group_member(integer,integer,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_group_application(integer,integer,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_group_members_bulk(integer,integer[],integer,text) TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.small_group_members FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_group_applications(bigint,uuid,jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
