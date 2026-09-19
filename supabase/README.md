# Database Migrations

## 실행 순서

새 Supabase 인스턴스에 아래 순서대로 적용합니다.

| 순서 | 파일 | 설명 |
|------|------|------|
| 1 | `phase2-members.sql` | profiles, members, member_status_log 테이블 + RLS |
| 2 | `phase3-small-groups.sql` | 시즌, 소그룹 테이블 |
| 3 | `phase4-attendance.sql` | 출석 추적 테이블 |
| 4 | `phase5-newfamily-onetoone.sql` | 새가족 + 일대일 양육 테이블 |
| 5 | `phase6-member-fields.sql` | 멤버 추가 필드 (kakao_id, school_or_work 등) |
| 6 | `phase7-newfamily-status.sql` | 새가족 상태 흐름 |
| 7 | `phase8-ministry-teams.sql` | 사역팀 테이블 |
| 8 | `phase9-upper-rooms.sql` | 다락방 구조 |
| 9 | `phase10-role-rename.sql` | 역할명 변경 |
| 10 | `phase11-attendance-redesign.sql` | 출석 스키마 재설계 |
| 11 | `role-management.sql` | 역할 관리 함수 |
| 12 | `season-and-leave.sql` | 시즌 + 휴적 관리 |
| 13 | `split-member-name.sql` | name → last_name + first_name 분리 |
| 14 | `newfamily-step-redesign.sql` | 새가족 단계 재설계 |
| 15 | `visitor-card-rls.sql` | 방문카드 RLS 정책 |
| 16 | `security-phase1.sql` | 보안 강화 1단계 (익명 접근 제한) |
| 17 | `security-phase2.sql` | 보안 강화 2단계 (JWT 기반 RLS) |

### 목양 협업 기능

기존 운영 DB에는 `phase24-pastoral-care-foundation.sql`을 현재 마이그레이션 뒤에 적용합니다. 이 파일은 열린 돌봄, 연락 기록, 다음 행동, 담당자와 공개 범위를 위한 테이블·RLS·기록 함수를 추가합니다.

## 적용 방법

```bash
# Supabase 대시보드 > SQL Editor에서 파일 내용 붙여넣기
# 또는 psql 사용:
psql $DATABASE_URL < supabase/파일명.sql
```

## 네이밍 컨벤션

새 마이그레이션 파일: `YYYYMMDD-설명.sql`

예시: `20260312-add-prayer-notes.sql`

### 방문·새가족 운영 개편 (2026-09-19)

`20260919-new-family-workflow.sql`은 새 앱 배포 **직전에** 적용해야 합니다. 새 앱은 교육 차수와 등록 기록을 조회하므로 미적용 상태에서는 배포하지 않습니다. `20260919-new-family-workflow-finalize.sql`은 새 앱 배포 성공 확인 후 적용하여 이전 공개 입력 정책을 제거합니다. 배포 중에는 기존 방문 카드의 입력 정책을 유지합니다.

- 방문 접수는 방문 상태, 새가족 기록, 활성 학기 새가족순 배정을 한 트랜잭션으로 저장합니다. 활성 학기가 없으면 전체 접수를 취소합니다.
- 해당 학기에 새가족순이 없으면 새가족 다락방과 순을 생성합니다. 기존에 같은 이름의 순이 여러 개 있으면 적용 전에 정리해야 합니다.
- 기존 명단은 방문 여부를 추정해 일괄 변경하거나 기존 순에서 이동시키지 않습니다. 기존 명단의 새가족순 편성은 운영자가 확인해야 합니다. 학기 전환 때 새가족순 편성도 확인합니다.
- 교육 차수와 참여·이수는 별도 표에 보관합니다. 교육 이수로 멤버 상태를 자동 전환하지 않습니다.
- 정식 등록은 기존 편집 권한(admin, upper_room_leader)에서 확정하며 확정자·시간·상태 이력을 함께 저장합니다. 새가족순 담당자 선택 자체가 계정 권한을 부여하지는 않습니다.
- 이전 `adjusting → attending` 명시적 처리 이력이 있는 교육 이수자는 `legacy`로 보존합니다. 이력이 없는 과거 등록자는 자동 판정하지 않으므로 개편 후 담당자가 확인해야 합니다.
- 운영 DB 연결 설정이 없는 작업 환경에서는 SQL 파일을 준비하고 로컬 검증까지만 할 수 있습니다. 운영 적용/배포는 별도로 확인합니다.

로컬 DB 동작 검증은 임시 설치한 `@electric-sql/pglite`를 사용합니다. 운영 데이터에는 연결하지 않습니다.

```bash
npm install --prefix /tmp/ium-db-check --cache /tmp/ium-npm-cache --no-audit --no-fund @electric-sql/pglite
node scripts/check-new-family-workflow.mjs /tmp/ium-db-check/node_modules/@electric-sql/pglite/dist/index.js
```

검증 범위: 대표 기존 스키마 위의 마이그레이션 실행, 방문자 실제 순 배정, 미이수 등록 차단, 일반 상태 편집 우회 차단, 이수 시 상태 유지, 확정자 기록, 중복 확정 방지, 권한 거부, 복귀 시 이력 보존, 활성 학기 없는 접수의 전체 실패. 운영 DB 전체 스키마·기존 데이터 이관 검증을 대신하지 않습니다.
