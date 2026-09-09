BEGIN;

CREATE TABLE IF NOT EXISTS public.ministry_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
  category text NOT NULL CHECK (category IN ('worship','formation','community','event','meeting','deadline')),
  status text NOT NULL DEFAULT 'tentative' CHECK (status IN ('tentative','confirmed','cancelled')),
  start_date date NOT NULL,
  end_date date,
  start_time time,
  location text, audience text, coordinator text, description text, resource_url text,
  service_type text CHECK (service_type IN ('주일','금요','수련회','특별','기타')),
  event_id integer UNIQUE REFERENCES public.events(id) ON DELETE SET NULL,
  source_key text UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE TABLE IF NOT EXISTS public.dashboard_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 3000),
  start_date date NOT NULL, end_date date NOT NULL,
  link_url text, source_key text UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS ministry_calendar_dates ON public.ministry_calendar(start_date, end_date) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS dashboard_notices_dates ON public.dashboard_notices(start_date, end_date) WHERE archived_at IS NULL;

-- Approved ministry accounts read shared schedules. Only admins publish changes.
-- No policy, grant, or query changes any private cc_* table.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ministry_calendar','dashboard_notices'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='shared_ministry_read') THEN
      EXECUTE format('CREATE POLICY shared_ministry_read ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN (''admin'',''upper_room_leader'',''group_leader'')))', t);
      EXECUTE format('CREATE POLICY shared_admin_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role=''admin''))', t);
      EXECUTE format('CREATE POLICY shared_admin_update ON public.%I FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role=''admin'')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role=''admin''))', t);
    END IF;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', t);
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=('public.' || t)::regclass AND tgname='shared_touch_updated_at') THEN
      EXECUTE format('CREATE TRIGGER shared_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', t);
    END IF;
  END LOOP;
END $$;

-- Source: 2026 가을학기 마스터 일정 v0.3, confirmed dates only.
-- These are shared dates, not copied personal tasks or pastoral notes.
INSERT INTO public.ministry_calendar(title,category,status,start_date,audience,description,source_key) VALUES
 ('In the Beginning 1주차','formation','confirmed','2026-09-13','새가족과 기존 멤버 전체','3주 온보딩 · 시간·장소·세부 진행은 확인 후 안내','fall-2026-onboarding-1'),
 ('In the Beginning 2주차','formation','confirmed','2026-09-20','새가족과 기존 멤버 전체','3주 온보딩 · 시간·장소·세부 진행은 확인 후 안내','fall-2026-onboarding-2'),
 ('In the Beginning 3주차','formation','confirmed','2026-09-27','새가족과 기존 멤버 전체','3주 온보딩 · 시간·장소·세부 진행은 확인 후 안내','fall-2026-onboarding-3')
ON CONFLICT(source_key) DO NOTHING;

INSERT INTO public.ministry_calendar(title,category,status,start_date,service_type,audience,source_key)
SELECT '주일예배','worship','confirmed',d::date,'주일','이음채플 전체','fall-2026-worship-' || to_char(d,'YYYY-MM-DD')
FROM generate_series('2026-09-06'::date,'2026-09-27'::date,'7 days') d
ON CONFLICT(source_key) DO NOTHING;

INSERT INTO public.ministry_calendar(title,category,status,start_date,service_type,audience,description,event_id,source_key)
VALUES ('야외예배','worship','confirmed','2026-10-04','주일','이음채플 전체','날짜 확정 · 장소·시간·우천 대안은 확인 후 안내',
  (SELECT id FROM public.events WHERE start_date='2026-10-04' AND name LIKE '%야외예배%' ORDER BY id LIMIT 1),'fall-2026-outdoor')
ON CONFLICT(source_key) DO NOTHING;

-- Planning deadlines are explicitly tentative, not reported as completed/confirmed.
INSERT INTO public.ministry_calendar(title,category,status,start_date,start_time,description,source_key) VALUES
 ('In the Beginning 최종 공지 준비','deadline','tentative','2026-09-10',NULL,'가을 마스터 일정 기준안 · 공지 내용·담당 확인 필요','fall-2026-deadline-onboarding'),
 ('야외예배 인원·식사·차량 취합','deadline','tentative','2026-09-27',NULL,'가을 마스터 일정 기준안 · 최종 취합 방식 확인 필요','fall-2026-deadline-outdoor'),
 ('야외예배 진행 여부 결정','deadline','tentative','2026-10-02','19:00','가을 마스터 일정 기준안 · 야외/실내 최종 안내 준비','fall-2026-weather-decision')
ON CONFLICT(source_key) DO NOTHING;

INSERT INTO public.dashboard_notices(title,body,start_date,end_date,source_key)
VALUES ('가을 사역 일정 안내','In the Beginning은 9월 13일·20일·27일, 야외예배는 10월 4일입니다. 시간과 장소는 확정되는 대로 공동 캘린더에서 안내합니다.','2026-09-09','2026-10-04','fall-2026-calendar-opening')
ON CONFLICT(source_key) DO NOTHING;

COMMIT;
