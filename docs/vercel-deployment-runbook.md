# Vercel Deployment Runbook

프론트엔드와 백엔드를 모두 Vercel에 배포하기 위한 작업 목록이다.

공식 참고:
- Vercel Monorepos: https://vercel.com/docs/monorepos
- Vercel NestJS: https://vercel.com/docs/frameworks/backend/nestjs
- Vercel Environment Variables: https://vercel.com/docs/environment-variables
- Vercel Project Settings: https://vercel.com/docs/project-configuration/project-settings

## 1. 배포 구조

이 repo는 monorepo이므로 Vercel 프로젝트를 2개 만든다.

| Vercel Project | Root Directory | 역할 |
| --- | --- | --- |
| `dodomi-frontend` | `frontend` | React/Vite 정적 프론트 |
| `dodomi-backend` | `backend` | NestJS Vercel Function 백엔드 |

Vercel 공식 문서 기준 monorepo는 같은 Git repo를 여러 프로젝트로 import하고, 각 프로젝트의 Root Directory를 해당 하위 폴더로 지정한다.

## 2. 배포 전 로컬 확인

배포 전 최소 1회 실행한다.

```bash
npm run check
```

이 명령은 다음을 실행한다.

```bash
npm --prefix backend run build
npm --prefix frontend run build
```

DB schema 변경이 있다면 배포 전에 migration 적용 상태도 확인한다. 이 프로젝트는 Supabase direct DB host가 현재 환경에서 IPv4 접근 문제를 만들 수 있으므로, 필요 시 `AGENTS.md`의 수동 migration 절차를 따른다.

## 3. 도메인 결정

관리자 로그인 세션은 cookie 기반이고 프론트 요청은 `credentials: 'include'`를 사용한다. 현재 백엔드는 cookie `sameSite: 'lax'`를 사용하므로, 운영에서는 프론트와 백엔드를 같은 site로 잡는 구성이 가장 안전하다.

권장:

```text
Frontend: https://dodomi.example.com
Backend:  https://api.dodomi.example.com
```

주의:
- `https://frontend-project.vercel.app`와 `https://backend-project.vercel.app`처럼 서로 다른 Vercel 기본 도메인만 사용하면 브라우저 cookie 정책 때문에 관리자 세션이 예상대로 동작하지 않을 수 있다.
- Vercel 기본 도메인으로 먼저 smoke test는 가능하지만, 관리자 로그인까지 안정적으로 보려면 커스텀 도메인 연결을 우선한다.

## 4. Backend Vercel Project 생성

Vercel Dashboard에서:

1. `Add New...` -> `Project`
2. 이 GitHub repo import
3. Root Directory를 `backend`로 설정
4. Framework Preset은 NestJS/Node 계열 자동 감지를 사용한다.
5. Build Command는 기본값이 맞지 않으면 `npm run build`로 설정한다.
6. Install Command는 기본값이 맞지 않으면 `npm install`로 설정한다.
7. Production Branch는 `main`으로 둔다.

Vercel NestJS 문서 기준 `src/main.ts`는 인식 가능한 entrypoint 이름이다. 현재 백엔드가 이 조건을 만족한다.

## 5. Backend 환경변수

Backend project의 Production 환경에 아래 값을 설정한다.

필수:

```text
NODE_ENV=production
API_PREFIX=api/v1
DATABASE_URL=<Supabase session pooler URL>
SESSION_SECRET=<32자 이상의 강한 랜덤 문자열>
SESSION_NAME=admin_session
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_MAX_AGE_MS=604800000
CORS_ORIGIN=https://dodomi.example.com,https://www.dodomi.example.com
TRUST_PROXY=1
REDIS_URL=<Upstash Redis-compatible rediss:// URL>
REDIS_KEY_PREFIX=dodomi:
SESSION_REDIS_ENABLED=true
ADMIN_LOGIN_RATE_LIMIT_REDIS_ENABLED=true
ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS=900
ADMIN_LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS=20
ADMIN_LOGIN_RATE_LIMIT_ACCOUNT_IP_MAX_ATTEMPTS=5
CLOUDINARY_CLOUD_NAME=<value>
CLOUDINARY_API_KEY=<value>
CLOUDINARY_API_SECRET=<value>
CLOUDINARY_UPLOAD_FOLDER=dodomi
STORE_WEB_BASE_URL=https://dodomi.example.com
ADMIN_WEB_BASE_URL=https://dodomi.example.com
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_ANON_KEY=<anon-key>
LOG_LEVEL=info
DB_KEEP_WARM_ENABLED=false
```

주문/입금 설정:

```text
ORDER_SHIPPING_FEE=3000
ORDER_DEPOSIT_BANK_NAME=<은행명>
ORDER_DEPOSIT_ACCOUNT_HOLDER=<예금주>
ORDER_DEPOSIT_ACCOUNT_NUMBER=<계좌번호>
ORDER_DEPOSIT_DEADLINE_DAYS=1
```

알림 설정:

```text
NOTIFICATIONS_ENABLED=true
NOTIFICATIONS_DRY_RUN=false
NOTIFICATIONS_ADMIN_STATUS_SUMMARY_ENABLED=true
NOTIFICATIONS_RETRY_ATTEMPTS=3
NOTIFICATIONS_RETRY_BASE_DELAY_MS=1000
```

SMS를 실제 발송할 경우:

```text
SOLAPI_API_KEY=<value>
SOLAPI_API_SECRET=<value>
SOLAPI_SENDER=<value>
```

이메일을 실제 발송할 경우:

```text
SMTP_HOST=<value>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<value>
SMTP_PASS=<value>
SMTP_FROM_NAME=Dodomi
SMTP_FROM_EMAIL=<value>
SMTP_CONNECTION_TIMEOUT_MS=10000
```

아직 실발송을 막고 싶으면:

```text
NOTIFICATIONS_DRY_RUN=true
```

선택:

```text
SENTRY_DSN=<value>
```

## 6. Frontend Vercel Project 생성

Vercel Dashboard에서:

1. `Add New...` -> `Project`
2. 같은 GitHub repo import
3. Root Directory를 `frontend`로 설정
4. Framework Preset은 Vite로 설정한다.
5. Build Command는 `npm run build`
6. Output Directory는 `dist`
7. Install Command는 기본값이 맞지 않으면 `npm install`
8. Production Branch는 `main`

## 7. Frontend 환경변수

Frontend project의 Production 환경에 아래 값을 설정한다.

```text
VITE_APP_NAME=DODOMIII MARKET
VITE_APP_ENV=production
VITE_APP_URL=https://dodomi.example.com
VITE_API_BASE_URL=https://api.dodomi.example.com/api/v1
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

선택:

```text
VITE_SENTRY_DSN=<value>
```

Vite 환경변수는 build 시점에 번들에 포함된다. 값을 바꾸면 frontend를 다시 배포해야 한다.

## 8. Supabase 준비

1. Supabase DB migration 적용 상태 확인
2. `DATABASE_URL`은 session pooler 주소 사용
3. Storage/RLS 정책이 현재 운영 요구와 맞는지 확인
4. `SUPABASE_SERVICE_ROLE_KEY`는 backend에만 설정
5. `VITE_SUPABASE_ANON_KEY`는 frontend에만 공개값으로 설정

## 9. Redis 준비

운영 백엔드는 `SESSION_REDIS_ENABLED=true`와 `ADMIN_LOGIN_RATE_LIMIT_REDIS_ENABLED=true`를 강제한다. Upstash Redis를 만들고 Redis-compatible URL을 `REDIS_URL`에 넣는다.

확인할 것:
- URL이 `rediss://` 형식인지
- session key 충돌 방지를 위해 `REDIS_KEY_PREFIX=dodomi:`가 들어갔는지
- Production env에만 실제 Redis 값을 넣었는지

## 10. Cloudinary 준비

상품/관리자 이미지 업로드 기능을 쓰려면 Cloudinary 값이 필요하다.

확인할 것:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_FOLDER=dodomi`

## 11. GitHub Actions Warmer 설정

이미 `.github/workflows/supabase-warmer.yml`이 있다. GitHub repo의 Actions Secret에 아래 값을 넣는다.

```text
Name: WARMUP_URL
Value: https://api.dodomi.example.com/api/v1/warmup
```

동작:
- 10분마다 `WARMUP_URL` 호출
- 3초 뒤 한 번 더 호출
- Actions 로그에 `http_code`, `time_starttransfer`, `time_total` 출력

수동 테스트:

1. GitHub repo -> `Actions`
2. `Supabase Warmer`
3. `Run workflow`
4. 로그에서 `http_code=200` 확인

## 12. 배포 순서

권장 순서:

1. Supabase migration 적용 확인
2. Redis/Cloudinary/알림 provider 준비
3. Backend Vercel project 생성
4. Backend env 입력
5. Backend 배포
6. Backend health 확인
7. Backend custom domain 연결
8. Frontend Vercel project 생성
9. Frontend env 입력
10. Frontend 배포
11. Frontend custom domain 연결
12. Backend `CORS_ORIGIN`, `STORE_WEB_BASE_URL`, `ADMIN_WEB_BASE_URL`을 최종 frontend 도메인으로 재확인
13. Backend 재배포
14. GitHub Actions `WARMUP_URL` Secret 설정
15. Warmer 수동 실행

## 13. 배포 후 Smoke Test

Backend:

```bash
curl -i https://api.dodomi.example.com/api/v1/health
curl -i https://api.dodomi.example.com/api/v1/warmup
```

기대:
- HTTP 200
- `success: true`
- `warmup`은 DB 연결 문제가 있으면 실패해야 정상이다.

Frontend:
- 메인 페이지 접속
- 상품 목록 조회
- 상품 상세 조회
- 장바구니 담기
- 주문 입력 화면 진입

Admin:
- 관리자 로그인
- 새로고침 후 세션 유지 확인
- 상품/공지/주문 관리 화면 진입
- 이미지 업로드가 필요한 화면에서 Cloudinary 업로드 확인

Notifications:
- 운영 전에는 `NOTIFICATIONS_DRY_RUN=true`로 먼저 배포
- 주문 상태 변경 또는 입금 요청 플로우에서 로그 확인
- 실발송 준비가 끝나면 `NOTIFICATIONS_DRY_RUN=false`로 전환 후 재배포

Warmer:
- GitHub Actions 수동 실행
- 첫 호출과 두 번째 호출의 `time_total` 비교
- 실패 시 Vercel backend logs와 Supabase connection 상태 확인

## 14. 모니터링

기본:
- Vercel Dashboard -> Deployments
- Vercel Dashboard -> Runtime Logs
- GitHub Actions -> Supabase Warmer 로그
- Supabase Dashboard -> DB/API 상태
- Upstash Dashboard -> Redis 요청/오류

권장:
- UptimeRobot 같은 무료 외부 모니터로 `GET /api/v1/health` 체크
- 장애 알림은 이메일/Discord/Slack 중 하나로 연결
- Sentry를 쓸 경우 backend `SENTRY_DSN`, frontend `VITE_SENTRY_DSN` 설정 후 코드 연동 여부 확인

## 15. 비용 방지 체크

1. Vercel Hobby 사용량 확인
2. GitHub Actions 사용량 확인
3. GitHub Actions billing limit/budget을 0 또는 안전한 값으로 설정
4. Supabase plan과 DB egress/connection 사용량 확인
5. Upstash free quota 확인
6. Cloudinary free quota 확인

## 16. 알려진 주의사항

- Vercel의 NestJS 배포는 단일 Vercel Function으로 동작한다. 상시 실행 서버가 아니므로 process memory에 상태를 저장하면 안 된다.
- `DB_KEEP_WARM_ENABLED=false`를 권장한다. Vercel Function 내부 timer는 항상 실행되는 워커가 아니므로, keep-warm은 GitHub Actions가 담당한다.
- `CORS_ORIGIN`은 쉼표로 구분해 여러 origin을 허용할 수 있다. 예: `https://dodomi.example.com,https://www.dodomi.example.com`
- Frontend env는 build 결과물에 박힌다. backend URL 변경 후에는 frontend 재배포가 필요하다.
- Backend env 변경은 기존 deployment에 반영되지 않는다. env 변경 후 backend를 재배포한다.
- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `REDIS_URL`, Cloudinary secret은 frontend에 절대 넣지 않는다.
