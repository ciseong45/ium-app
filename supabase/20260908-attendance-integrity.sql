-- Requires 20260908-care-foundation.sql.
BEGIN;
CREATE FUNCTION public.can_record_group(p_group_id integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.small_groups g
 JOIN public.small_group_seasons s ON s.id=g.season_id
 LEFT JOIN public.upper_rooms u ON u.id=g.upper_room_id
 JOIN public.profiles p ON p.id=auth.uid()
 WHERE g.id=p_group_id AND (p.role='admin' OR (s.is_active AND ((p.role='group_leader' AND p.linked_member_id=g.leader_id) OR (p.role='upper_room_leader' AND p.linked_member_id=u.leader_id)))));
$$;
CREATE FUNCTION public.can_record_member(p_member_id integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.care_is_admin() OR EXISTS(SELECT 1 FROM public.small_group_members m WHERE m.member_id=p_member_id AND public.can_record_group(m.group_id));
$$;
DROP POLICY attendance_auth_select ON public.attendance;
DROP POLICY attendance_auth_insert ON public.attendance;
DROP POLICY attendance_auth_update ON public.attendance;
DROP POLICY attendance_auth_delete ON public.attendance;
CREATE POLICY attendance_scoped_read ON public.attendance FOR SELECT TO authenticated USING (public.can_record_member(member_id));
CREATE POLICY attendance_scoped_insert ON public.attendance FOR INSERT TO authenticated WITH CHECK (public.can_record_member(member_id) AND checked_by=auth.uid());
CREATE POLICY attendance_scoped_update ON public.attendance FOR UPDATE TO authenticated USING (public.can_record_member(member_id)) WITH CHECK (public.can_record_member(member_id) AND checked_by=auth.uid());
CREATE POLICY attendance_scoped_delete ON public.attendance FOR DELETE TO authenticated USING (public.can_record_member(member_id));
CREATE FUNCTION public.save_group_attendance(p_group_id integer,p_week_date date,p_records jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb; v_member integer;
BEGIN
 IF NOT public.can_record_group(p_group_id) THEN RAISE EXCEPTION 'ATTENDANCE_DENIED'; END IF;
 IF p_week_date IS NULL OR p_records IS NULL OR jsonb_typeof(p_records)<>'array' OR jsonb_array_length(p_records) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'ATTENDANCE_INVALID'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_records)) <> (SELECT count(DISTINCT value->>'member_id') FROM jsonb_array_elements(p_records)) THEN RAISE EXCEPTION 'ATTENDANCE_DUPLICATE'; END IF;
 -- Validate the entire batch before any write. An invalid row rolls back everything.
 FOR r IN SELECT value FROM jsonb_array_elements(p_records) LOOP
  v_member:=(r->>'member_id')::integer;
  IF v_member IS NULL OR NOT EXISTS(SELECT 1 FROM public.small_group_members WHERE group_id=p_group_id AND member_id=v_member) THEN RAISE EXCEPTION 'ATTENDANCE_MEMBER_DENIED'; END IF;
  IF NOT(r ? 'status') OR ((r->>'status') IS NOT NULL AND r->>'status' NOT IN ('present','absent')) OR jsonb_typeof(r->'prayer_request') IS DISTINCT FROM 'boolean' OR length(coalesce(r->>'prayer_note',''))>2000 THEN RAISE EXCEPTION 'ATTENDANCE_INVALID'; END IF;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(p_records) LOOP
  v_member:=(r->>'member_id')::integer;
  IF (r->>'status') IS NULL THEN
   DELETE FROM public.attendance WHERE member_id=v_member AND week_date=p_week_date;
  ELSE
   INSERT INTO public.attendance(member_id,week_date,status,prayer_request,prayer_note,checked_by)
   VALUES(v_member,p_week_date,r->>'status',(r->>'prayer_request')::boolean,CASE WHEN (r->>'prayer_request')::boolean THEN nullif(r->>'prayer_note','') ELSE NULL END,auth.uid())
   ON CONFLICT(member_id,week_date) DO UPDATE SET status=excluded.status,prayer_request=excluded.prayer_request,prayer_note=excluded.prayer_note,checked_by=excluded.checked_by;
  END IF;
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.can_record_group(integer),public.can_record_member(integer),public.save_group_attendance(integer,date,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_record_group(integer),public.can_record_member(integer),public.save_group_attendance(integer,date,jsonb) TO authenticated;
COMMIT;
