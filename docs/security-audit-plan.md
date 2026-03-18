# ium-app 보안 점검 & 보강 계획

## 감사 결과 요약

**애플리케이션 레벨 인가(role 체크)는 잘 되어있으나**, 데이터베이스 RLS 정책이 `USING(true)`로 모두 열려있어 Supabase anon key를 아는 누구나 직접 DB 쿼리로 모든 데이터에 접근 가능한 상태. 추가로 CSV 인젝션, 익명 접근 범위, 에러 메시지 노출 등의 문제 발견.

### 보안 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| 인증 (Authentication) | ✅ 양호 | Supabase SSR + 쿠키 기반 세션 |
| 역할 기반 인가 (App Level) | ✅ 양호 | 모든 서버 액션에 role 체크 있음 |
| RLS 정책 (DB Level) | ❌ 위험 | 모든 테이블 `USING(true)` |
| 익명 접근 범위 | ❌ 위험 | anon으로 전체 멤버 SELECT 가능 |
| 입력 검증 | ✅ 양호 | Zod 스키마 일관 사용 |
| CSRF 보호 | ✅ 양호 | Next.js 서버 액션 자동 보호 |
| SQL 인젝션 | ✅ 양호 | Supabase 파라미터화 쿼리 |
| CSV 수식 인젝션 | ❌ 위험 | escapeCsvField에 수식 문자 방어 없음 |
| Rate Limiting | ❌ 미구현 | 방문자 카드 무제한 제출 가능 |
| 에러 메시지 노출 | ⚠️ 주의 | Supabase error.message 직접 반환 |
| 민감 데이터 노출 | ⚠️ 주의 | SELECT * 로 불필요한 필드 전달 |

---

## Phase 1: 긴급 수정 (외부 공격 방어)

> 인증 없이 접근 가능한 취약점 우선 차단

### 1A. 익명 사용자 members SELECT 제한

**문제:** `members_anon_select_own` 정책이 `USING(true)` → 비로그인 상태에서 Supabase API로 전체 멤버 데이터(이름, 전화번호, 이메일, 주소, 생년월일) 조회 가능

**수정:**
```sql
-- supabase/security-phase1.sql
DROP POLICY IF EXISTS "members_anon_select_own" ON members;
CREATE POLICY "members_anon_select_recent" ON members
  FOR SELECT TO anon
  USING (status = 'new_family' AND created_at > now() - interval '2 minutes');
```

**영향:** 방문자 카드 제출 시 `.insert().select("id")` 는 방금 생성된 new_family 레코드라 정상 동작

### 1B. CSV 수식 인젝션 방어

**문제:** `escapeCsvField()`가 `=`, `+`, `@`, `-`로 시작하는 값을 그대로 내보냄 → Excel에서 수식 실행 가능

**파일:** `src/app/(dashboard)/members/actions.ts`

**수정:**
```typescript
function escapeCsvField(value: string): string {
  let sanitized = value;
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = "'" + sanitized;
  }
  if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}
```

### 1C. 방문자 카드 Rate Limiting

**문제:** 비로그인 상태에서 무제한 제출 가능 → DB 스팸 공격

**파일:** `src/app/visitor-card/actions.ts`

**수정:**
- IP 기반 인메모리 rate limiter 추가 (시간당 5건)
- `headers()`에서 `x-forwarded-for` 추출

```typescript
const submissions = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1시간
const MAX_SUBMISSIONS = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (submissions.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
  if (timestamps.length >= MAX_SUBMISSIONS) return false;
  timestamps.push(now);
  submissions.set(ip, timestamps);
  return true;
}
```

---

## Phase 2: RLS 정책 강화 (DB 레벨 인가)

> 현재 앱의 role 체크를 DB에도 반영하여 이중 방어

### 2A. 역할 확인 헬퍼 함수

```sql
-- supabase/security-phase2.sql
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### 2B. 테이블별 RLS 정책 교체

**원칙:**
- SELECT: 모든 인증 사용자 허용 (앱 구조상 모든 페이지에서 전체 데이터 조회 필요)
- INSERT/UPDATE: `admin` + `upper_room_leader` 허용
- DELETE: `admin`만 허용

| 테이블 | SELECT | INSERT/UPDATE | DELETE |
|--------|--------|---------------|--------|
| members | authenticated | admin, upper_room_leader | admin |
| small_group_seasons | authenticated | admin | admin |
| small_groups | authenticated | admin | admin |
| small_group_members | authenticated | admin, upper_room_leader | admin, upper_room_leader |
| attendance | authenticated | admin, upper_room_leader | admin |
| new_family | authenticated | admin, upper_room_leader | admin |
| one_to_one | authenticated | admin, upper_room_leader | admin |
| one_to_one_sessions | authenticated | admin, upper_room_leader | admin |
| upper_rooms | authenticated | admin | admin |
| member_status_log | authenticated | admin, upper_room_leader | — |
| member_leaves | authenticated | admin, upper_room_leader | admin |
| member_ministry_teams | authenticated | admin, upper_room_leader | admin |

**⚠️ 중요:** 코드 배포 성공 확인 후 SQL 실행할 것

---

## Phase 3: 애플리케이션 레벨 보강

### 3A. 에러 메시지에서 DB 상세 정보 제거

**문제:** Supabase `error.message` (테이블명, 제약조건명 등)가 클라이언트에 직접 노출

**대상 파일:**
- `src/app/(dashboard)/members/actions.ts` — CSV 임포트 에러
- `src/app/(dashboard)/settings/actions.ts` — linkMemberToUser, updateUserRole

**패턴:**
```typescript
// Before (위험)
if (error) return { success: false, error: error.message };

// After (안전)
if (error) {
  console.error("Operation failed:", error.message);
  return { success: false, error: "작업에 실패했습니다." };
}
```

### 3B. 불필요한 필드 노출 줄이기

- `getMembers()`: `.select("*")` → 필요한 컬럼만 명시
- `getUnassignedMembers()`: `.select("*")` → `id, last_name, first_name, status`
- 소그룹 멤버 조회: `member:members(*)` → `member:members(id, last_name, first_name, status)`

### 3C. 검색 파라미터 SQL LIKE 와일드카드 이스케이프

**파일:** `src/app/(dashboard)/members/actions.ts`
```typescript
const sanitized = search.replace(/[%_]/g, '\\$&');
```

---

## Phase 4: 입력 검증 강화

### 4A. CSV 임포트 이메일 검증
- 기존 정규식 → Zod의 `z.string().email()` 사용으로 통일

### 4B. CSV 보안 테스트 추가
**파일:** `src/lib/__tests__/csv-sanitize.test.ts` (신규)
- `=cmd|'/c calc'!A1` 등 위험 문자열 방어 테스트
- 정상 한글/영문 값 통과 테스트

---

## 수정 대상 파일 요약

| 파일 | 변경 내용 | Phase |
|------|----------|-------|
| `supabase/security-phase1.sql` | **신규** — 익명 SELECT 제한 | 1 |
| `supabase/security-phase2.sql` | **신규** — RLS 정책 전면 교체 | 2 |
| `src/app/(dashboard)/members/actions.ts` | CSV 인젝션 방어, 에러 메시지, SELECT 필드 제한, 검색 이스케이프 | 1,3,4 |
| `src/app/visitor-card/actions.ts` | Rate limiter 추가 | 1 |
| `src/app/(dashboard)/settings/actions.ts` | 에러 메시지 제거 | 3 |
| `src/lib/__tests__/csv-sanitize.test.ts` | **신규** — CSV 보안 테스트 | 4 |

## 검증 방법
1. **Phase 1:** 방문자 카드 제출 정상 동작 + 6번째 제출 시 차단 확인, CSV 내보내기 후 수식 미실행 확인
2. **Phase 2:** admin/upper_room_leader/group_leader 각각 로그인하여 CRUD 확인
3. **Phase 3-4:** `npm test` 통과 + Vercel 배포 성공 확인 후 Phase 2 SQL 실행
