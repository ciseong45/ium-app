# IUM Chapel 관리시스템 — 프로젝트 로드맵

## 현재 상태 요약

| 영역 | 점수 | 비고 |
|------|------|------|
| 프로젝트 구조 | 8/10 | App Router 잘 활용, Route Group 분리 |
| 보안 | 7/10 | RLS + 입력검증 좋으나, CSP/Rate Limit 미흡 |
| 타입 안전성 | 8/10 | Zod + TS 잘 연동 |
| 테스트 | 3/10 | TDD 선언 대비 실제 테스트 극히 부족 |
| DB 설계 | 7/10 | 도메인 잘 모델링, 마이그레이션 관리 미흡 |
| 코드 품질 | 7/10 | 일관된 패턴, 관심사 분리 개선 여지 |
| 확장성 | 6/10 | 현재 규모에 적합, 성장 시 리팩토링 필요 |
| DX (개발 경험) | 6/10 | 에러 바운더리, 토스트 등 부재 |

**종합: 6.5/10**

---

## Phase 1 — 기반 다지기

> 목표: 프로덕션 품질 확보, 안정적인 개발 사이클 구축

### 1.1 테스트 인프라 구축
- [ ] `jest`, `ts-jest`, `@testing-library/react` 설치 및 `package.json` scripts 추가
- [ ] Server Action 단위테스트 작성 (members, attendance, small-groups)
- [ ] 핵심 컴포넌트 렌더링 테스트 (Sidebar, Header, DashboardLayout)
- [ ] E2E 프레임워크 도입 (Playwright 권장)
- [ ] 핵심 플로우 E2E: 로그인 → 출석 체크 → 새가족 등록

### 1.2 에러 처리 체계
- [ ] `error.tsx` — 전역 및 라우트별 에러 바운더리
- [ ] `loading.tsx` — 라우트별 로딩 스켈레톤
- [ ] `not-found.tsx` — 404 페이지
- [ ] Toast/Notification 시스템 도입 (sonner 또는 react-hot-toast)
- [ ] Server Action 에러 → 클라이언트 피드백 표준화

### 1.3 CI/CD 파이프라인
- [ ] GitHub Actions 워크플로우 구성: lint → test → build → deploy
- [ ] PR 머지 시 자동 Vercel Preview 배포
- [ ] main 브랜치 푸시 시 프로덕션 배포
- [ ] 테스트 커버리지 리포트 자동 생성

### 1.4 DB 마이그레이션 표준화
- [ ] Supabase CLI 도입 (`supabase init`, `supabase migration`)
- [ ] 기존 `phase*.sql` → `supabase/migrations/` 표준 형식으로 정리
- [ ] 로컬 개발용 Supabase 환경 구성 (`supabase start`)
- [ ] `.env.example` 파일 추가

### 1.5 보안 강화
- [ ] `next.config.ts`에 보안 헤더 설정 (CSP, X-Frame-Options 등)
- [ ] Rate Limiting 실제 구현 (Supabase Edge Function 또는 미들웨어)
- [ ] CORS 정책 명시적 설정

---

## Phase 2 — 사용자 경험 개선

> 목표: 실사용자 만족도 향상, 데이터 기반 의사결정 지원

### 2.1 대시보드 시각화
- [ ] 차트 라이브러리 도입 (recharts 또는 chart.js)
- [ ] 주간 출석 추이 그래프
- [ ] 새가족 정착률 차트 (유입 → 양육 → 정착 퍼널)
- [ ] 소그룹별 출석률 비교 차트
- [ ] 시즌별 성장 지표

### 2.2 알림 시스템
- [ ] 카카오 알림톡 또는 이메일 알림 인프라
- [ ] 출석 미체크 리마인더 (리더에게)
- [ ] 새가족 양육 단계 전환 알림
- [ ] 장기 미출석자 알림 (2주 이상)

### 2.3 모바일 최적화 (PWA)
- [ ] PWA manifest + Service Worker 설정
- [ ] 오프라인 캐시 (출석 체크 → 온라인 복귀 시 동기화)
- [ ] 모바일 전용 출석 체크 UI
- [ ] 홈 화면 추가 지원

### 2.4 폼 UX 개선
- [ ] React Hook Form 도입 → 복잡한 폼 성능/UX 개선
- [ ] 인라인 유효성 검사 피드백
- [ ] 자동 저장 / 임시 저장

---

## Phase 3 — 기능 확장

> 목표: 관리자 전용 → 전체 멤버 사용 플랫폼으로 확장

### 3.1 멤버 셀프서비스 포탈
- [ ] 멤버 로그인 (소셜 로그인 또는 초대 링크)
- [ ] 본인 출석 이력 조회
- [ ] 개인정보 수정 (연락처, 주소 등)
- [ ] 소속 소그룹 확인 및 멤버 목록

### 3.2 설교 자료 통합
- [ ] 설교 스터디 컴포넌트 앱 내 임베딩
- [ ] 주차별 설교 자료 아카이브
- [ ] 소그룹 나눔 가이드 연동

### 3.3 일정 캘린더
- [ ] 예배/행사 일정 관리
- [ ] 소그룹 모임 일정
- [ ] Google Calendar 연동 (선택)
- [ ] 일정 알림

### 3.4 기도제목 나눔
- [ ] 소그룹 내 기도제목 등록/공유
- [ ] 기도 응답 체크
- [ ] 주간 기도제목 요약

### 3.5 재정/헌금 관리 (선택)
- [ ] 헌금 기록 시스템
- [ ] 영수증 발행
- [ ] 월별/연별 재정 리포트

---

## Phase 4 — 규모 확장 & 아키텍처 진화

> 목표: 코드베이스 지속 가능성 확보, 멀티앱 대응

### 4.1 레이어 분리 리팩토링
- [ ] `services/` 레이어 도입 (비즈니스 로직 분리)
- [ ] `repositories/` 레이어 도입 (DB 쿼리 분리)
- [ ] `actions.ts` → 얇은 진입점으로 축소

```
현재:  Page → actions.ts (검증 + DB + 비즈니스 혼재)
목표:  Page → actions.ts → services/ → repositories/
```

### 4.2 Supabase Realtime 활용
- [ ] 출석 체크 실시간 반영
- [ ] 동시 편집 충돌 방지
- [ ] 실시간 알림 (새가족 방문 등)

### 4.3 공유 UI 라이브러리
- [ ] Radix UI 또는 Headless UI 도입
- [ ] 공통 컴포넌트 표준화 (모달, 드롭다운, 테이블, 페이지네이션)
- [ ] Storybook 도입 (선택)

### 4.4 모노레포 전환 (앱 2개 이상 시)
- [ ] Turborepo 또는 pnpm workspace 구성
- [ ] 패키지 분리:

```
ium/
├── apps/
│   ├── admin/        ← 현재 앱 (관리자)
│   └── member/       ← 멤버용 앱
├── packages/
│   ├── db/           ← Supabase 클라이언트 + 타입
│   ├── ui/           ← 공유 UI 컴포넌트
│   └── domain/       ← 비즈니스 로직
```

### 4.5 성능 최적화
- [ ] React Server Components 최적화 (직렬 → 병렬 데이터 로딩)
- [ ] 이미지 최적화 (next/image + Supabase Storage)
- [ ] 번들 분석 및 코드 스플리팅
- [ ] DB 인덱스 최적화

### 4.6 모니터링 & 관측성
- [ ] Sentry 에러 트래킹
- [ ] Vercel Analytics / Speed Insights
- [ ] 커스텀 로깅 (주요 비즈니스 이벤트)
- [ ] Uptime 모니터링

---

## 기술 스택 진화 요약

| 영역 | 현재 | Phase 1-2 추가 | Phase 3-4 추가 |
|------|------|----------------|----------------|
| 프레임워크 | Next.js 16 | — | — |
| DB | Supabase | Supabase CLI | Realtime |
| 테스트 | (미설치) | Jest + Playwright | — |
| 상태관리 | Context | React Hook Form | — |
| UI | 인라인 Tailwind | Toast 라이브러리 | Radix UI |
| 차트 | — | recharts | — |
| 알림 | — | 카카오/이메일 | Realtime |
| 모바일 | 반응형 CSS | PWA | — |
| 모니터링 | — | Sentry | Analytics |
| CI/CD | — | GitHub Actions | — |
| 빌드 | npm | — | Turborepo |

---

## 의사결정 기록

| 날짜 | 결정 | 근거 |
|------|------|------|
| 2026-03-12 | 아키텍처 평가 완료 | 종합 6.5/10, 테스트와 에러 처리가 가장 시급 |
| | | |

---

*마지막 업데이트: 2026-03-12*
