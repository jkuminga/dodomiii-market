# Transaction Pooler Migration Checklist

작성일: 2026-04-30

## 목적

Vercel에 배포된 NestJS 백엔드의 Supabase DB 연결을 session pooler에서 transaction pooler로 전환한다.

현재 장애 원인은 session mode에서 Vercel 함수 인스턴스별 DB client slot이 오래 점유되어 Supabase pooler `pool_size`를 초과하는 것이다. Transaction mode로 바꾸면 실제 DB connection은 쿼리/트랜잭션 수행 중에만 빌려 쓰고 반납하므로, serverless 환경에서 idle connection 누적 위험을 줄일 수 있다.

## 브랜치 필요 여부

이 작업의 핵심은 Vercel/Supabase 운영 환경변수 변경이므로 새 브랜치는 필수가 아니다.

브랜치가 필요한 경우:
- 이 체크리스트 문서 변경을 Git에 남기고 PR/commit으로 관리하려는 경우
- `DATABASE_URL` 구성 helper, 로그, smoke test 스크립트 등 repo 코드도 함께 수정하는 경우

브랜치가 없어도 되는 경우:
- Vercel Dashboard에서 `DATABASE_URL`만 바꾸고 redeploy하는 경우
- Supabase Dashboard에서 pooler 설정만 확인/수정하는 경우

권장:
- 운영 env 변경 자체는 브랜치 없이 진행한다.
- 문서 변경을 저장할 계획이면 `codex/transaction-pooler-runbook` 같은 작은 브랜치를 따로 만들어 커밋한다.

## 변경 범위

변경 대상:
- Vercel backend project의 Production `DATABASE_URL`
- 필요 시 Supabase Database Connection Pooling 설정
- 필요 시 GitHub Actions warmer 일시 중지 또는 빈도 축소

변경하지 않을 것:
- `DIRECT_URL`
- Prisma migration 경로
- Supabase service role key
- frontend env
- Prisma schema/migration 파일

## 사전 확인

- [ ] 현재 Production backend가 어떤 Vercel project인지 확인했다.
- [ ] 현재 Production `DATABASE_URL` 값을 백업했다.
- [ ] Supabase Dashboard 접근 권한이 있다.
- [ ] Vercel Dashboard 접근 권한이 있다.
- [ ] 관리자 테스트 계정 정보를 확인했다.
- [ ] 배포 직후 테스트할 시간대를 확보했다.
- [ ] 장애 발생 시 기존 session pooler URL로 rollback할 수 있다.

## 현재 상태 확인

### 1. 현재 오류 확인

- [ ] Vercel backend logs에서 아래 오류가 재현되는지 확인했다.

```text
EMAXCONNSESSION
max clients reached in session mode
pool_size: 15
```

### 2. 현재 코드 방어 확인

- [ ] `backend/src/common/prisma/prisma.service.ts`에서 `connection_limit=1` 자동 추가가 유지되고 있다.
- [ ] Vercel Production env에 아래 값이 있다.

```text
DB_KEEP_WARM_ENABLED=false
```

### 3. Warmer 확인

- [ ] `.github/workflows/supabase-warmer.yml` 또는 GitHub Actions warmer 사용 여부를 확인했다.
- [ ] 전환 중에는 warmer를 임시 중지하거나 빈도를 낮추기로 결정했다.

## Supabase 작업

### 1. Transaction pooler URL 확보

- [ ] Supabase Dashboard에 접속했다.
- [ ] Project Settings 또는 Database Settings의 Connection Pooling 섹션으로 이동했다.
- [ ] Transaction mode connection string을 확인했다.
- [ ] pooler host, port, database, user 형식이 올바른지 확인했다.
- [ ] 비밀번호 placeholder가 실제 DB password로 치환되어 있는지 확인했다.

### 2. Pool 설정 확인

- [ ] 현재 pool size를 확인했다.
- [ ] max client connections 또는 관련 제한값을 확인했다.
- [ ] 너무 낮은 pool size라면 임시 상향 여부를 결정했다.
- [ ] Auth, Storage, PostgREST 등 Supabase 내부 서비스용 connection 여유를 남겼다.

## Vercel 작업

### 1. DATABASE_URL 작성

Transaction pooler URL에 Prisma pooler 옵션을 붙인다.

기본 형태:

```text
postgresql://.../postgres?pgbouncer=true&connection_limit=1
```

이미 query string이 있는 경우:

```text
postgresql://.../postgres?sslmode=require&pgbouncer=true&connection_limit=1
```

체크:
- [ ] transaction pooler URL이다.
- [ ] session pooler URL이 아니다.
- [ ] `pgbouncer=true`가 있다.
- [ ] `connection_limit=1`이 있다.
- [ ] URL encoding이 깨지지 않았다.
- [ ] 비밀번호의 특수문자가 URL-safe 하게 처리되어 있다.

### 2. Vercel env 변경

- [ ] Vercel Dashboard에서 backend project를 열었다.
- [ ] Settings -> Environment Variables로 이동했다.
- [ ] Production `DATABASE_URL`을 새 transaction pooler URL로 변경했다.
- [ ] Preview/Development env는 이번 작업 범위에 포함할지 결정했다.
- [ ] `DIRECT_URL`은 변경하지 않았다.
- [ ] `DB_KEEP_WARM_ENABLED=false`가 유지되어 있다.

### 3. Redeploy

- [ ] backend production deployment를 redeploy했다.
- [ ] build가 성공했다.
- [ ] runtime 로그에서 Prisma 초기화 오류가 없는지 확인했다.
- [ ] 첫 요청에서 500이 나지 않는지 확인했다.

## Smoke Test

아래 테스트는 Production URL 기준으로 수행한다.

### Public store

- [ ] health endpoint 또는 warmup endpoint 응답 확인
- [ ] 상품 목록 조회
- [ ] 상품 상세 조회
- [ ] 공지 목록 조회
- [ ] 주문 생성
- [ ] 주문 조회

### Admin

- [ ] 관리자 로그인
- [ ] 관리자 세션 유지 확인
- [ ] 상품 목록 조회
- [ ] 상품 수정
- [ ] 주문 목록 조회
- [ ] 주문 상태 변경
- [ ] 운송장/배송 정보 수정

### Error 확인

- [ ] Vercel logs에 `EMAXCONNSESSION`이 없다.
- [ ] Vercel logs에 prepared statement 관련 오류가 없다.
- [ ] Vercel logs에 Prisma transaction 관련 오류가 없다.
- [ ] Supabase logs 또는 chart에서 connection이 계속 누적되지 않는다.

## 관측 포인트

전환 후 30분에서 1시간 동안 아래를 본다.

- [ ] Vercel Function error rate
- [ ] Vercel Function duration
- [ ] Vercel cold start 또는 init error
- [ ] Supabase client connections
- [ ] Supabase pooler usage
- [ ] 주문 생성/관리자 수정 같은 write flow 오류

기대 상태:
- idle session client가 계속 쌓이지 않는다.
- 피크 때 connection이 올라갔다가 내려간다.
- `max clients reached in session mode`가 재발하지 않는다.

## Rollback 절차

문제가 발생하면 아래 순서로 되돌린다.

- [ ] Vercel backend Production `DATABASE_URL`을 백업해둔 기존 session pooler URL로 되돌린다.
- [ ] backend production redeploy를 실행한다.
- [ ] health endpoint가 복구되는지 확인한다.
- [ ] 관리자 로그인과 상품 조회를 확인한다.
- [ ] Vercel logs에서 새 오류가 사라졌는지 확인한다.
- [ ] 발생한 오류 메시지를 기록한다.

Rollback 후 확인할 오류 유형:
- `prepared statement ... already exists`
- `prepared statement ... does not exist`
- `Transaction already closed`
- `P1001`
- `P2028`
- `too many clients`
- `max clients reached`

## 성공 기준

- [ ] Production backend가 정상 배포되었다.
- [ ] Public store 핵심 조회 flow가 정상이다.
- [ ] 주문 생성 flow가 정상이다.
- [ ] Admin 로그인/수정 flow가 정상이다.
- [ ] Vercel logs에 Prisma 초기화 오류가 없다.
- [ ] `EMAXCONNSESSION`이 재발하지 않는다.
- [ ] Supabase connection chart에서 idle connection 누적이 줄었다.

## 후속 작업

- [ ] `docs/backend-prisma-vercel-connection-strategy.md`에 실제 전환 결과를 기록한다.
- [ ] `docs/vercel-deployment-runbook.md`의 Backend `DATABASE_URL` 권장값을 transaction pooler 기준으로 업데이트할지 결정한다.
- [ ] warmer를 다시 켤지 결정한다.
- [ ] pool size를 유지할지 조정할지 결정한다.
- [ ] 같은 문제가 재발하면 long-running backend 이전 검토를 시작한다.

## Local Validation Log

### 2026-04-30

로컬 `backend/.env`의 `DATABASE_URL`을 Supabase transaction pooler URL로 변경한 뒤 검증했다.

확인된 URL 형태:
- host: `aws-1-ap-southeast-2.pooler.supabase.com`
- port: `6543`
- database: `/postgres`
- `pgbouncer=true`
- `connection_limit=1`

실행:

```bash
PORT=4010 npm --prefix backend run start:dev
```

결과:
- [x] TypeScript watch compilation 성공
- [x] Nest app boot 성공
- [x] Prisma `$connect()` 성공
- [x] `/api/v1/health` 200
- [x] `/api/v1/warmup` 200
- [x] `/api/v1/store/categories` 200
- [x] `/api/v1/store/products?size=3` 200
- [x] 관리자 로그인 201
- [x] `/api/v1/admin/auth/me` 200
- [x] `/api/v1/admin/products?size=3` 200
- [x] `/api/v1/admin/orders?size=3` 200

주의:
- 처음 `npm --prefix backend run start:dev`는 기존 로컬 프로세스가 `4000` 포트를 점유하고 있어 `EADDRINUSE`로 listen 단계에서 실패했다. `PORT=4010`으로 재실행해 검증했다.
- `DB_KEEP_WARM_ENABLED`가 로컬에서는 false가 아니어서 `DB keep-warm enabled interval=600000ms` 로그가 출력됐다. Production에서는 계속 `DB_KEEP_WARM_ENABLED=false`를 유지해야 한다.
- `20`개 동시 `/api/v1/warmup` 요청은 일부가 약 10초 후 500으로 실패했다. 이는 `connection_limit=1`인 단일 로컬 Nest 프로세스에서 Prisma 쿼리 대기열이 길어진 결과로 보인다.
- `5`개 동시 `/api/v1/warmup` 요청은 모두 200으로 성공했다.
- 운영 DB 데이터 변경을 피하기 위해 주문 생성, 상품 수정, 주문 상태 변경 같은 write smoke test는 실행하지 않았다.

운영 전환 전 판단:
- transaction pooler 자체 연결과 기본 read flow는 통과했다.
- Production Vercel 전환 후에는 실제 Vercel 인스턴스 분산 환경에서 error rate와 duration을 관측해야 한다.
- write flow는 Production 전환 직후 관리자 화면에서 수동으로 최소 1회 검증한다.
