# Backend Prisma/Vercel DB Connection Strategy

작성일: 2026-04-30

## 문제 요약

Vercel에 배포된 백엔드에서 아래 오류가 발생했다.

```text
PrismaClientInitializationError: Error querying the database:
FATAL: (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15
```

현재 백엔드는 `PrismaService`에서 `DATABASE_URL`에 `connection_limit=1`을 런타임에 자동 추가한다. 즉, 한 Vercel 함수 인스턴스 안에서 Prisma connection pool이 여러 DB connection을 열지 않도록 막는 방어는 이미 들어가 있다.

그런데 이 조치는 "인스턴스당 최대 1개"를 의미할 뿐이다. Vercel이 트래픽, 콜드 스타트, 배포 전환, 워머 호출 때문에 여러 함수 인스턴스를 동시에 띄우면 전체 연결 수는 아래처럼 증가한다.

```text
총 session pool client 수 ~= 활성 Vercel 함수 인스턴스 수 x 인스턴스당 Prisma connection_limit
```

따라서 `connection_limit=1`이어도 활성 함수 인스턴스가 16개가 되면 Supabase session pooler의 `pool_size: 15`를 초과할 수 있다.

## 현재 구조에서의 핵심 원인

### 1. Session mode는 연결을 오래 붙잡는다

Supabase session pooler는 클라이언트 연결 하나에 DB connection 하나를 세션 동안 전용으로 배정한다. 연결이 idle이어도 세션이 살아 있으면 슬롯을 계속 점유한다.

이 오류의 `EMAXCONNSESSION`은 바로 이 session mode의 client 제한에 걸렸다는 뜻이다.

### 2. Vercel 함수 인스턴스는 자동으로 늘어난다

Vercel Functions는 요청마다 invocation을 만들고, 필요하면 함수 인스턴스를 자동 확장한다. 같은 인스턴스를 재사용하기도 하지만, 트래픽이 겹치거나 콜드 스타트가 늘면 여러 인스턴스가 동시에 존재한다.

현재 `src/main.ts`는 Vercel 함수 인스턴스 안에서 Nest app과 Express server를 `cachedServer`로 캐싱한다. 이 방식은 같은 인스턴스 안에서는 앱과 PrismaClient를 재사용하므로 올바른 방향이다. 다만 인스턴스 간에는 메모리를 공유하지 못한다.

### 3. Keep-warm과 GitHub Actions warmer는 연결 수를 늘릴 수 있다

`PrismaService`에는 DB keep-warm timer가 있고, 배포 런북에는 GitHub Actions warmer도 있다. 운영 환경변수에서 `DB_KEEP_WARM_ENABLED=false`를 권장하고 있으므로 이 값은 반드시 유지해야 한다.

워머 자체도 짧은 시간에 여러 Vercel 인스턴스를 깨우면 session pool client 수를 증가시킬 수 있다. 트래픽이 낮은 서비스에서는 워머가 안정성을 돕지만, pool size가 작은 상태에서는 연결 슬롯을 계속 점유하는 원인이 될 수 있다.

## 대응 전략

### 단기: 운영 장애를 멈추는 설정 점검

1. `DATABASE_URL`이 Supabase session pooler URL인지 확인한다.
   - session mode는 보통 pooler host의 `:5432`를 사용한다.
   - 이 경우 `connection_limit=1`은 계속 필요하다.

2. Vercel Production 환경변수에 아래 값이 들어가 있는지 확인한다.

```text
DB_KEEP_WARM_ENABLED=false
```

3. GitHub Actions warmer를 임시 중지하거나 호출 빈도를 낮춘다.
   - 특히 배포 직후, 트래픽 피크 시간, 장애 재현 중에는 warmer가 추가 인스턴스를 만들 수 있다.
   - session pool size가 15인 상태에서는 "10분마다 2회 호출"도 상황에 따라 불리할 수 있다.

4. Supabase Dashboard에서 pool size와 client connection 그래프를 확인한다.
   - `pool_size: 15`가 실제로 운영 트래픽에 충분한지 확인한다.
   - 다른 서비스, Supabase Auth, Storage, PostgREST가 쓰는 연결 여유도 같이 봐야 한다.

5. 당장 복구가 필요하면 Supabase session pool size를 올린다.
   - 단, DB max connections 전체를 다 pooler에 몰아주면 Auth/Storage/관리 연결이 밀릴 수 있다.
   - Supabase는 PostgREST 사용량이 크면 pool size를 DB max connections의 40% 이상으로 올릴 때 주의하고, 그렇지 않으면 약 80%까지 배정할 수 있다고 안내한다.

### 중기: Session mode 의존도를 낮춘다

가장 현실적인 구조 개선은 runtime `DATABASE_URL`을 Supabase transaction pooler로 전환하는 것이다.

```text
DATABASE_URL=<Supabase transaction pooler URL>?pgbouncer=true&connection_limit=1
```

의미:
- transaction mode는 connection을 세션 전체가 아니라 transaction/query 수행 중에만 빌려 쓰게 하므로 serverless와 더 잘 맞는다.
- Prisma는 Supavisor/PgBouncer 계열 pooler에서 `pgbouncer=true`를 사용할 수 있다.
- migration은 계속 pooler가 아니라 direct/admin connection으로 다뤄야 한다. 이 repo는 이미 `AGENTS.md`에 수동 migration 절차를 유지하고 있다.

주의:
- Prisma 문서 기준 PgBouncer는 transaction mode에서 안정적으로 동작해야 한다.
- Supavisor/PgBouncer 버전과 prepared statement 설정에 따라 `pgbouncer=true` 필요 여부가 달라질 수 있다. Supabase Supavisor 연결에서는 보수적으로 `pgbouncer=true`를 붙여 검증하는 쪽이 안전하다.
- 전환 후에는 관리자 로그인, 상품 조회, 주문 생성, 주문 상태 변경 같은 쓰기 흐름을 반드시 smoke test한다.

### 장기: 백엔드 실행 모델을 바꾼다

트래픽이 계속 늘거나 DB 연결 수가 운영 리스크로 반복되면, Vercel Function 기반 NestJS 백엔드를 장기 실행 서버로 옮기는 선택지가 있다.

후보:
- Fly.io, Render, Railway 같은 long-running Node server
- Supabase와 같은 region에 가까운 VM/container
- Vercel은 frontend만 유지하고 backend는 별도 origin으로 분리

장점:
- 프로세스 수를 명시적으로 제한할 수 있다.
- PrismaClient pool 크기와 서버 replica 수를 곱해서 DB connection 상한을 계산하기 쉽다.
- session pooler를 쓰더라도 연결 수 예측 가능성이 높아진다.

단점:
- 배포/런타임 운영 부담이 Vercel serverless보다 커진다.
- autoscaling, health check, 로그/모니터링 구성을 별도로 관리해야 한다.

## 권장 실행 순서

1. Vercel Production env에서 `DB_KEEP_WARM_ENABLED=false` 확인
2. GitHub Actions warmer 임시 중지 또는 빈도 축소
3. Supabase session pool size를 현재 트래픽에 맞게 상향
4. Supabase Dashboard에서 connection chart로 피크 연결 수 확인
5. staging 또는 preview에서 transaction pooler URL + `pgbouncer=true` 검증
6. 검증 통과 후 production `DATABASE_URL`을 transaction pooler로 전환
7. 배포 직후 관리자/스토어 핵심 flow smoke test
8. 같은 오류가 재발하면 backend를 long-running server로 분리하는 계획 착수

## 관측 쿼리

현재 DB에 붙어 있는 live connection을 볼 때는 Supabase SQL Editor 또는 Prisma raw query로 아래를 확인한다.

```sql
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  state,
  wait_event_type,
  wait_event,
  now() - state_change AS state_age,
  left(query, 120) AS query_preview
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY state_age DESC;
```

idle connection이 많이 남아 있으면 session mode에서 슬롯이 묶이고 있다는 신호다.

## 참고 문서

- Vercel Functions lifecycle: https://vercel.com/docs/functions
- Vercel connection pooling guide: https://vercel.com/kb/guide/connection-pooling-with-functions
- Prisma connection pool: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool
- Prisma with PgBouncer/Supavisor: https://docs.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer
- Supabase connection management: https://supabase.com/docs/guides/database/connection-management
- Supabase Supavisor terminology: https://supabase.com/docs/guides/troubleshooting/supavisor-and-connection-terminology-explained-9pr_ZO
