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

## 적용 방법

```bash
# Supabase 대시보드 > SQL Editor에서 파일 내용 붙여넣기
# 또는 psql 사용:
psql $DATABASE_URL < supabase/파일명.sql
```

## 네이밍 컨벤션

새 마이그레이션 파일: `YYYYMMDD-설명.sql`

예시: `20260312-add-prayer-notes.sql`
