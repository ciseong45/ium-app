-- Care foundation. Additive tables; existing member states are not changed.
BEGIN;
CREATE OR REPLACE FUNCTION public.care_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin');
$$;
CREATE OR REPLACE FUNCTION public.care_is_approved() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('admin','upper_room_leader','group_leader'));
$$;
-- Prevent self-escalation through the existing own-profile write policies.
CREATE OR REPLACE FUNCTION public.guard_profile_authority() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.care_is_admin() THEN
  IF TG_OP='INSERT' THEN
   IF NEW.role <> 'pending' OR NEW.linked_member_id IS NOT NULL THEN RAISE EXCEPTION 'PROFILE_AUTHORITY_DENIED'; END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role OR NEW.linked_member_id IS DISTINCT FROM OLD.linked_member_id THEN
   RAISE EXCEPTION 'PROFILE_AUTHORITY_DENIED';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guard_profile_authority BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_authority();

CREATE TABLE public.care_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 member_id integer NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
 next_action text NOT NULL CHECK (length(btrim(next_action)) BETWEEN 1 AND 500),
 due_date date NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','waiting','completed','cancelled')),
 assigned_to uuid REFERENCES public.profiles(id),
 handoff_to uuid REFERENCES public.profiles(id),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (handoff_to IS NULL OR handoff_to IS DISTINCT FROM assigned_to),
 CHECK (status IN ('open','waiting') OR handoff_to IS NULL)
);
CREATE INDEX care_actions_member ON public.care_actions(member_id);
CREATE INDEX care_actions_due ON public.care_actions(status,due_date);
CREATE TABLE public.care_action_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 action_id uuid NOT NULL REFERENCES public.care_actions(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 operation text NOT NULL CHECK (operation IN ('create','complete','wait','reopen','cancel','handoff','accept','decline')),
 note text NOT NULL DEFAULT '' CHECK (length(note)<=2000),
 from_assignee uuid REFERENCES public.profiles(id), to_assignee uuid REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_events_action ON public.care_action_events(action_id,created_at);
ALTER TABLE public.care_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_action_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY care_read ON public.care_actions FOR SELECT TO authenticated USING (
 public.care_is_approved() AND (public.care_is_admin() OR auth.uid() IN (created_by,assigned_to,handoff_to))
);
CREATE POLICY care_event_read ON public.care_action_events FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.care_actions a WHERE a.id=action_id)
);
REVOKE ALL ON public.care_actions, public.care_action_events FROM anon, authenticated;
GRANT SELECT ON public.care_actions, public.care_action_events TO authenticated;

CREATE FUNCTION public.create_care_action(p_member_id integer,p_next_action text,p_due_date date,p_assignee uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_owner uuid; v_handoff uuid;
BEGIN
 IF NOT public.care_is_admin() THEN RAISE EXCEPTION 'CARE_DENIED'; END IF;
 IF p_due_date IS NULL OR length(btrim(p_next_action)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'CARE_INVALID'; END IF;
 IF p_assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_assignee AND role IN ('admin','upper_room_leader','group_leader')) THEN RAISE EXCEPTION 'CARE_ASSIGNEE_INVALID'; END IF;
 IF p_assignee=auth.uid() THEN v_owner:=auth.uid();
 ELSIF p_assignee IS NOT NULL THEN v_owner:=auth.uid(); v_handoff:=p_assignee; END IF;
 INSERT INTO public.care_actions(member_id,next_action,due_date,assigned_to,handoff_to,created_by)
 VALUES(p_member_id,btrim(p_next_action),p_due_date,v_owner,v_handoff,auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.care_action_events(action_id,actor_id,operation,note,to_assignee)
 VALUES(v_id,auth.uid(),'create',btrim(p_next_action),v_owner);
 IF v_handoff IS NOT NULL THEN
  INSERT INTO public.care_action_events(action_id,actor_id,operation,note,from_assignee,to_assignee)
  VALUES(v_id,auth.uid(),'handoff','등록 시 담당 인계 요청',v_owner,v_handoff);
 END IF;
 RETURN v_id;
END;
$$;
CREATE FUNCTION public.change_care_action(p_id uuid,p_version integer,p_operation text,p_note text DEFAULT '',p_target uuid DEFAULT NULL,p_due_date date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.care_actions%ROWTYPE; v_previous uuid; v_target uuid;
BEGIN
 IF NOT public.care_is_approved() THEN RAISE EXCEPTION 'CARE_DENIED'; END IF;
 SELECT * INTO a FROM public.care_actions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CARE_DENIED'; END IF;
 IF p_operation IN ('accept','decline') THEN
  IF a.handoff_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'CARE_DENIED'; END IF;
 ELSE
  IF NOT public.care_is_admin() AND a.assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'CARE_DENIED'; END IF;
 END IF;
 IF p_version IS DISTINCT FROM a.version THEN RAISE EXCEPTION 'CARE_CONFLICT'; END IF;
 IF p_operation IS NULL OR p_operation NOT IN ('complete','wait','reopen','cancel','handoff','accept','decline') THEN RAISE EXCEPTION 'CARE_INVALID'; END IF;
 IF length(coalesce(p_note,''))>2000 OR (p_operation<>'accept' AND length(btrim(coalesce(p_note,'')))=0) THEN RAISE EXCEPTION 'CARE_NOTE_REQUIRED'; END IF;
 IF p_operation='reopen' THEN
  IF a.status NOT IN ('completed','cancelled') THEN RAISE EXCEPTION 'CARE_STATE_INVALID'; END IF;
 ELSIF a.status NOT IN ('open','waiting') THEN RAISE EXCEPTION 'CARE_STATE_INVALID'; END IF;
 v_previous:=a.assigned_to;
 CASE p_operation
 WHEN 'complete' THEN a.status:='completed'; a.handoff_to:=NULL;
 WHEN 'cancel' THEN a.status:='cancelled'; a.handoff_to:=NULL;
 WHEN 'wait','reopen' THEN
  IF p_due_date IS NULL THEN RAISE EXCEPTION 'CARE_DATE_REQUIRED'; END IF;
  a.due_date:=p_due_date; a.status:=CASE WHEN p_operation='wait' THEN 'waiting' ELSE 'open' END;
 WHEN 'handoff' THEN
  IF a.handoff_to IS NOT NULL OR p_target IS NULL OR p_target IS NOT DISTINCT FROM a.assigned_to OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_target AND role IN ('admin','upper_room_leader','group_leader')) THEN RAISE EXCEPTION 'CARE_ASSIGNEE_INVALID'; END IF;
  a.handoff_to:=p_target; v_target:=p_target;
 WHEN 'accept' THEN a.assigned_to:=auth.uid(); a.handoff_to:=NULL; v_target:=auth.uid();
 WHEN 'decline' THEN v_target:=a.handoff_to; a.handoff_to:=NULL;
 END CASE;
 UPDATE public.care_actions SET status=a.status,due_date=a.due_date,assigned_to=a.assigned_to,handoff_to=a.handoff_to,version=version+1,updated_at=now() WHERE id=p_id;
 INSERT INTO public.care_action_events(action_id,actor_id,operation,note,from_assignee,to_assignee)
 VALUES(p_id,auth.uid(),p_operation,btrim(coalesce(p_note,'')),v_previous,coalesce(v_target,a.assigned_to));
END;
$$;
REVOKE ALL ON FUNCTION public.create_care_action(integer,text,date,uuid), public.change_care_action(uuid,integer,text,text,uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_care_action(integer,text,date,uuid), public.change_care_action(uuid,integer,text,text,uuid,date) TO authenticated;
REVOKE ALL ON FUNCTION public.care_is_admin(), public.care_is_approved() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_is_admin(), public.care_is_approved() TO authenticated;
COMMIT;
