# Supabase RLS 대응 체크리스트

작성일: 2026-04-27

## 결론

현재 프로젝트는 프론트엔드가 Supabase DB에 직접 접근하지 않고, 백엔드 API가 Prisma를 통해 Supabase Postgres에 접근하는 구조다.

이번 작업 범위는 모든 `public` 스키마 테이블에 RLS를 켜고, 기존 백엔드 + Prisma 접근이 유지되는지 확인하는 것이다.

## 결정 사항

- `public` 스키마는 유지한다.
- 테이블을 `private` 스키마로 이동하지 않는다.
- 모든 `public` 테이블에 `ENABLE ROW LEVEL SECURITY`를 적용한다.
- `FORCE ROW LEVEL SECURITY`는 적용하지 않는다.
- `anon` / `authenticated` role용 RLS policy는 추가하지 않는다.
- 기존 데이터 접근 경로는 `frontend -> backend API -> Prisma -> Supabase Postgres`로 유지한다.

## 기대 상태

- `anon`: Supabase API를 통한 DB 테이블 직접 접근 불가
- `authenticated`: Supabase API를 통한 DB 테이블 직접 접근 불가
- `backend + Prisma`: 기존처럼 DB 읽기/쓰기 가능
- Supabase 보안 경고: RLS 관련 경고 해소 또는 감소

## 테이블 분류

### 내부 메타데이터 테이블

- `_prisma_migrations`

### 공개 데이터 성격이 있지만 직접 DB 공개는 하지 않는 테이블

- `categories`
- `products`
- `product_images`
- `product_option_groups`
- `product_options`
- `home_popups`
- `home_hero_settings`
- `notices`

### 민감하거나 서버 전용으로 다뤄야 하는 테이블

- `admins`
- `orders`
- `order_items`
- `order_item_option_selections`
- `order_contacts`
- `deposits`
- `shipments`
- `order_status_histories`
- `custom_order_links`

## 작업자 체크리스트

### Codex가 수행할 작업

- [x] 현재 DB의 `public` 테이블 목록을 조회한다.
- [x] 각 테이블의 현재 RLS 상태를 조회한다.
- [x] 각 테이블의 `FORCE ROW LEVEL SECURITY` 상태를 조회한다.
- [x] `anon`, `authenticated` role에 부여된 테이블 권한을 조회한다.
- [x] 기존 RLS policy 존재 여부를 조회한다.
- [x] RLS 적용용 Prisma migration을 작성한다.
- [x] `ENABLE ROW LEVEL SECURITY`만 포함되어 있고 `FORCE ROW LEVEL SECURITY`가 없는지 검토한다.
- [x] 환경 제약상 `prisma migrate deploy`가 실패하면 Prisma raw SQL로 수동 적용한다.
- [x] 수동 적용 시 `_prisma_migrations`에 적용 완료 이력을 기록한다.
- [x] 적용 후 모든 대상 테이블의 RLS 상태를 재확인한다.
- [x] 적용 후 `FORCE ROW LEVEL SECURITY`가 꺼져 있는지 재확인한다.
- [x] 적용 후 `_prisma_migrations` 적용 상태를 확인한다.
- [x] Prisma로 주요 읽기 쿼리가 가능한지 확인한다.
- [x] Prisma로 안전한 임시 쓰기/삭제 쿼리가 가능한지 확인한다.
- [x] `anon` role이 주요 테이블 row를 조회할 수 없는지 확인한다.
- [x] `authenticated` role이 주요 테이블 row를 조회할 수 없는지 확인한다.
- [x] `anon` / `authenticated` role의 임시 insert가 RLS로 차단되는지 확인한다.
- [x] 고객용 주요 API가 정상인지 확인한다.
- [x] 관리자 주요 API가 정상인지 확인한다.
- [x] 결과와 남은 리스크를 문서와 최종 보고에 정리한다.

### 사용자가 수행할 작업

- [x] Supabase Dashboard에서 RLS 보안 경고가 해소 또는 감소했는지 확인한다.
- [ ] Supabase API Settings에서 exposed schema가 의도한 값인지 확인한다.
- [ ] Supabase 계정 2FA가 켜져 있는지 확인한다.
- [ ] Supabase 팀 멤버 권한이 필요한 사람에게만 부여되어 있는지 확인한다.
- [x] `service_role key`, `DATABASE_URL`, `DIRECT_URL`이 프론트 코드나 공개 저장소에 노출된 적 없는지 확인한다.
- [x] 노출 가능성이 있으면 Supabase key rotation 여부를 결정한다.
- [ ] 운영 배포 후 실제 사용자 플로우를 직접 확인한다.

## 검증 기준

성공 기준:

- 모든 `public` 테이블의 `relrowsecurity`가 `true`다.
- 모든 대상 테이블의 `relforcerowsecurity`가 `false`다.
- 신규 RLS migration이 repo에 존재한다.
- `_prisma_migrations`에 신규 migration이 applied 상태로 기록된다.
- backend + Prisma가 기존 주요 읽기/쓰기 경로에서 정상 동작한다.

실패 또는 중단 기준:

- RLS 적용 후 Prisma 기본 읽기 쿼리가 실패한다.
- RLS 적용 후 주문 생성 또는 관리자 조회 같은 핵심 쓰기/읽기 경로가 실패한다.
- 기존 policy가 발견되어 이번 결정 사항과 충돌한다.
- DB migration history가 실제 DB 상태와 맞지 않는다.

## 현재 점검 결과

점검일: 2026-04-27

- DB 접속 `current_user`는 `postgres`다.
- 모든 Prisma 관리 테이블의 owner는 `postgres`다.
- 모든 `public` 테이블의 RLS는 적용 전 기준 `false`다.
- 모든 `public` 테이블의 `FORCE ROW LEVEL SECURITY`는 적용 전 기준 `false`다.
- `pg_policies` 기준 기존 RLS policy는 없다.
- `anon`, `authenticated` role에 여러 테이블 권한이 부여되어 있다.
  - 이번 작업에서는 policy를 추가하지 않으므로 RLS 적용 후 Supabase API의 일반 row 접근은 기본 차단된다.
  - 권한 회수는 이번 범위에 포함하지 않고, 필요 시 별도 hardening 작업으로 다룬다.

## 적용 결과

적용일: 2026-04-27

- 신규 migration: `20260427010000_enable_public_table_rls`
- 적용 방식: Prisma raw SQL 수동 적용
- `_prisma_migrations` 기록:
  - `migration_name`: `20260427010000_enable_public_table_rls`
  - `finished_at`: 기록됨
  - `rolled_back_at`: `null`
  - `applied_steps_count`: `1`
- 적용 후 모든 `public` 테이블의 RLS가 `true`다.
- 적용 후 모든 `public` 테이블의 `FORCE ROW LEVEL SECURITY`가 `false`다.
- 적용 후 RLS policy는 여전히 없다.
- Prisma owner 경로 읽기 확인:
  - `admins`: 1건 조회 가능
  - `products`: 1건 조회 가능
  - `notices`: 1건 조회 가능
  - `orders`: 9건 조회 가능
- Prisma owner 경로 쓰기 확인:
  - `notices` 임시 row insert 후 즉시 delete 성공
- `anon` role 검증:
  - `admins`, `products`, `notices`, `orders` count 결과가 모두 0
  - `notices` insert는 `new row violates row-level security policy`로 실패
- `authenticated` role 검증:
  - `admins`, `products`, `notices`, `orders` count 결과가 모두 0
  - `notices` insert는 `new row violates row-level security policy`로 실패
- backend 테스트:
  - `npm --prefix backend test -- --runInBand`: 15 suites passed, 58 tests passed
  - `npm --prefix backend run build`: 성공
- 실제 API smoke test:
  - `GET /api/v1/health`: 200
  - `GET /api/v1/store/categories`: 200
  - `GET /api/v1/store/products`: 200
  - `GET /api/v1/store/home-popup`: 200
  - `GET /api/v1/store/home-hero`: 200
  - `GET /api/v1/store/notices`: 200
  - `POST /api/v1/admin/auth/login`: 201
  - `GET /api/v1/admin/auth/me`: 200
  - `GET /api/v1/admin/products`: 200
  - `GET /api/v1/admin/orders`: 200

## 남은 리스크와 후속 선택지

- `anon`, `authenticated`에 테이블 권한 grant가 남아 있다.
  - RLS policy가 없기 때문에 일반 row 단위 `SELECT` / `INSERT` / `UPDATE` / `DELETE`는 차단된다.
  - 다만 권한 자체를 최소화하고 싶다면 별도 migration에서 `REVOKE` hardening을 검토할 수 있다.
- Supabase Dashboard의 Security Advisor 결과는 사용자가 직접 확인했다.
- Supabase API Settings의 exposed schema, 계정 2FA, 팀 멤버 권한은 Dashboard 계정 설정 영역이라 Codex가 직접 확인하지 못했다.
- 이번 작업은 schema 이동, Supabase Auth 정책 설계, Storage bucket 정책 변경을 포함하지 않는다.

## 사용자 체크 결과

점검일: 2026-04-27

- RLS Security Advisor:
  - 사용자 확인 결과 RLS 관련 advisor 경고가 모두 사라졌다.
- Git 추적 상태:
  - `backend/.env`, `frontend/.env`, `.env`는 git tracked file이 아니다.
  - `backend/.env`, `frontend/.env`, `.env`가 git history에 commit된 기록은 없다.
  - `.gitignore`의 `**/.env` 규칙으로 env 파일이 ignore된다.
- 비밀값 검색:
  - 현재 추적 파일에서 실제 `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL` 값 노출은 발견되지 않았다.
  - 검색에 잡힌 항목은 `.env.example`, 문서, 테스트 placeholder, Prisma env 참조다.
- 프론트 Supabase 직접 접근:
  - `frontend/src`, `backend/src`에서 `@supabase/supabase-js`, `supabase.from`, `VITE_SUPABASE` 사용은 발견되지 않았다.
  - `createClient` 검색 결과는 Redis client 생성 코드뿐이다.
- Key rotation 판단:
  - 현재 로컬 repo 기준으로는 실비밀값 노출 증거가 없어 key rotation 필수 조건은 발견되지 않았다.
  - 로컬 외부 공유, 스크린샷, 배포 로그, 메신저 공유 이력은 사용자가 별도로 판단해야 한다.

## 적용 금지 항목

- `ALTER TABLE ... FORCE ROW LEVEL SECURITY`
- `CREATE POLICY ... TO anon`
- `CREATE POLICY ... TO authenticated`
- `public` 스키마에서 `private` 스키마로 테이블 이동
- 프론트엔드에 `service_role key` 또는 `DATABASE_URL` 추가
