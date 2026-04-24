# Pre-deploy Security Checklist

작성일: 2026-04-24

이 문서는 배포 전에 해결해야 할 보안 이슈를 한 파일에서 추적하기 위한 체크리스트다. 기준은 현재 코드베이스, 로컬 env 상태, 그리고 확인된 배포 준비 상태다.

## 현재 결론

아직 배포 전이라 치명적인 외부 노출은 발생하지 않았지만, 그대로 배포하면 가장 큰 위험은 고객 주문 개인정보 노출이다. 관리자 기능보다 공개 스토어 API 쪽에서 주문번호만 알면 주문 상세를 볼 수 있는 구조가 더 급하다.

배포 전 최소 완료 기준:

- [x] 공개 주문 조회 API에서 주문번호만으로 개인정보가 조회되지 않는다.
- [x] 입금 확인 요청 API가 주문번호만으로 상태를 바꾸지 못한다.
- [ ] 관리자 로그인에 rate limit 또는 실패 제한이 있다.
- [ ] 프로덕션 세션이 MemoryStore가 아닌 영속 store를 사용한다.
- [ ] 프로덕션 필수 환경변수가 누락되면 서버가 시작되지 않는다.
- [ ] 백엔드 의존성 취약점 audit 결과가 해결되어 있다.

## P0 - 배포 전 필수

### 1. 공개 주문 조회 보호

- [x] `GET /store/orders/:orderNumber`에 추가 인증값을 요구한다.
- [x] `GET /store/orders/:orderNumber/tracking`도 같은 방식으로 보호한다.
- [x] 보호 방식 결정:
  - [x] 주문번호 + 구매자/수령자 전화번호 검증
  - [ ] 또는 주문 생성 시 랜덤 조회 토큰 발급 후 토큰으로 조회
- [x] 고객 공개 응답에서 `deposit.adminMemo`를 제거한다.
- [x] 실패 시 주문 존재 여부가 쉽게 추측되지 않도록 에러 메시지를 일반화한다.
- [ ] 테스트 추가: 올바른 검증값 없이는 상세/배송조회가 실패한다.

위험 설명:

현재 주문번호 형식은 `DMYYYYMMDD-0001`처럼 날짜와 순번 기반이다. 누군가 날짜와 순번을 대입하면 다른 고객의 이름, 전화번호, 주소, 입금 정보까지 볼 수 있다.

관련 코드:

- `backend/src/modules/store/store.controller.ts`
  - `GET store/orders/:orderNumber`
  - `GET store/orders/:orderNumber/tracking`
- `backend/src/modules/store/store.service.ts`
  - `getOrderByOrderNumber`
  - `getOrderTracking`
  - `mapOrderDetail`
  - `generateOrderNumber`

### 2. 입금 확인 요청 보호

- [x] `POST /store/orders/:orderNumber/deposit-requests`에 주문 소유자 검증을 추가한다.
- [ ] 검증 실패 시 입금 상태가 바뀌지 않는 테스트를 추가한다.
- [ ] 반복 요청이 알림을 과도하게 발생시키지 않는지 확인한다.

위험 설명:

현재는 주문번호만 알면 입금 확인 요청 상태를 바꿀 수 있다. 이 API는 주문 상태 변경과 관리자 알림으로 이어지므로 공개 요청만으로 운영 흐름이 흔들릴 수 있다.

관련 코드:

- `backend/src/modules/store/store.controller.ts`
  - `POST store/orders/:orderNumber/deposit-requests`
- `backend/src/modules/store/store.service.ts`
  - `createDepositRequest`

### 3. 관리자 로그인 rate limit

- [ ] `/admin/auth/login`에 IP 기준 rate limit을 적용한다.
- [ ] 가능하면 loginId 기준 실패 횟수 제한도 추가한다.
- [ ] 실패 로그를 남기되 비밀번호나 민감값은 기록하지 않는다.
- [ ] 테스트 추가: 짧은 시간 내 과도한 로그인 실패가 차단된다.

위험 설명:

관리자 로그인은 bcrypt 검증과 공통 에러 메시지를 쓰고 있어 기본 구조는 괜찮다. 하지만 시도 횟수 제한이 없어 배포 후 무차별 대입 공격에 노출된다.

관련 코드:

- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/dto/login.dto.ts`

### 4. 프로덕션 세션 store 적용

- [ ] `express-session` 기본 MemoryStore를 제거한다.
- [ ] Redis, Postgres, Supabase 호환 DB store 중 하나를 선택한다.
- [ ] 세션 TTL이 `SESSION_COOKIE_MAX_AGE_MS`와 일관되게 만료되는지 확인한다.
- [ ] 서버 재시작 후 세션 동작 방식을 명확히 정한다.
- [ ] 스케일아웃 환경에서 여러 인스턴스가 같은 세션 store를 사용하도록 한다.

위험 설명:

현재 `express-session`에 별도 store가 없다. 기본 MemoryStore는 운영용이 아니며, 서버 재시작 시 로그인이 풀리고 여러 서버 인스턴스에서는 세션이 공유되지 않는다.

관련 코드:

- `backend/src/main.ts`

### 5. 프로덕션 환경변수 fail-fast

- [ ] `NODE_ENV=production`일 때 필수 env 검증을 추가한다.
- [ ] `SESSION_SECRET`이 기본값이거나 너무 짧으면 서버 시작을 막는다.
- [ ] `SESSION_COOKIE_SECURE=true`가 아니면 서버 시작을 막는다.
- [ ] `CORS_ORIGIN`이 localhost이거나 비어 있으면 서버 시작을 막는다.
- [ ] `DATABASE_URL`, Cloudinary, 알림 관련 필수값 정책을 정리한다.
- [ ] 프론트 `VITE_API_BASE_URL`, `VITE_APP_URL`을 실제 배포 도메인으로 설정한다.

위험 설명:

현재 설정은 개발 기본값을 많이 가진다. 배포 환경에서 env 하나가 빠져도 서버가 개발 설정으로 뜰 수 있다. 특히 세션 secret, secure cookie, CORS origin은 프로덕션에서 강제해야 한다.

관련 코드:

- `backend/src/common/config/env.config.ts`
- `backend/src/main.ts`
- `backend/.env.example`
- `frontend/.env.example`

### 6. 백엔드 의존성 취약점 해결

- [ ] `npm --prefix backend audit --omit=dev --audit-level=moderate` 결과를 0건으로 만든다.
- [ ] `npm audit fix` 적용 가능 범위를 확인한다.
- [ ] NestJS, `path-to-regexp`, `lodash`, `nodemailer` 관련 업데이트 후 빌드/테스트를 실행한다.
- [ ] `npm --prefix frontend audit --omit=dev --audit-level=moderate`도 재확인한다.

확인된 현재 상태:

- 백엔드: 6 vulnerabilities
  - high: `@nestjs/core`, `@nestjs/platform-express`, `path-to-regexp`, `lodash`
  - moderate: `nodemailer`
- 프론트엔드: 0 vulnerabilities

## P1 - 강력 권장

### 7. CSRF 방어

- [ ] 관리자 변경 API에 CSRF 토큰 또는 Origin/Referer 검증을 추가한다.
- [ ] `POST`, `PATCH`, `DELETE` 관리자 API 전체에 적용한다.
- [ ] 프론트 API 클라이언트가 CSRF 토큰을 함께 보내도록 수정한다.

위험 설명:

관리자 인증은 쿠키 세션 기반이다. 쿠키는 브라우저가 자동으로 붙이기 때문에, 관리자가 로그인한 상태에서 악성 페이지를 열면 의도치 않은 관리자 요청이 만들어질 수 있다.

관련 코드:

- `backend/src/main.ts`
- `backend/src/modules/admin/*.controller.ts`
- `frontend/src/lib/api.ts`

### 8. 보안 헤더 적용

- [ ] `helmet`을 적용한다.
- [ ] CSP 정책을 정한다.
- [ ] Cloudinary 이미지, Kakao postcode script 등 필요한 외부 출처만 허용한다.
- [ ] 관리자 페이지가 iframe에 들어가지 않도록 frame 정책을 둔다.

위험 설명:

현재 명시적인 보안 헤더 설정이 없다. XSS 피해 축소, clickjacking 방지, MIME sniffing 방지 같은 기본 방어선을 추가해야 한다.

관련 코드:

- `backend/src/main.ts`
- `frontend/src/pages/store/CartOrderPage.tsx`
- `frontend/src/pages/store/OrderPage.tsx`

### 9. Cloudinary 업로드 검증 강화

- [ ] `finalizeUpload`에서 Cloudinary signature를 필수로 검증한다.
- [ ] `resourceType === 'image'`를 서버에서도 필수 검증한다.
- [ ] `secureUrl`이 기대한 Cloudinary cloud name 도메인인지 검증한다.
- [ ] `publicId`가 허용된 업로드 folder prefix 아래인지 검증한다.
- [ ] `contentType`과 파일 크기 정책을 실제 업로드 파라미터에도 반영한다.

위험 설명:

업로드 서명 발급은 관리자 전용이고 크기 제한도 일부 있다. 하지만 finalize 단계에서 signature가 없으면 검증 없이 통과한다. 관리자 계정이 탈취되었거나 프론트 요청이 조작될 경우, 외부 이미지 URL이나 기대하지 않은 public id가 저장될 여지가 있다.

관련 코드:

- `backend/src/modules/admin/admin-media.service.ts`
- `backend/src/modules/admin/dto/admin-media-finalize.dto.ts`
- `frontend/src/pages/admin/AdminNoticeEditorPage.tsx`
- `frontend/src/pages/admin/AdminHomePopupPage.tsx`
- `frontend/src/pages/admin/AdminProductEditorPage.tsx`

### 10. 관리자 세션 유효성 재확인

- [ ] `AdminSessionGuard`에서 DB의 `isActive` 상태를 확인할지 결정한다.
- [ ] 최소한 계정 비활성화/권한 변경 시 기존 세션 무효화 정책을 정한다.
- [ ] `AdminSuperGuard`도 최신 role 기준으로 동작하도록 검토한다.

위험 설명:

현재 대부분의 관리자 API는 세션에 `admin` 객체가 있으면 통과한다. 계정이 비활성화되어도 이미 발급된 세션이 계속 남아 있을 가능성이 있다.

관련 코드:

- `backend/src/modules/auth/guards/admin-session.guard.ts`
- `backend/src/modules/auth/guards/admin-super.guard.ts`
- `backend/src/modules/auth/auth.service.ts`

### 11. CORS 배포 설정 고정

- [ ] `CORS_ORIGIN`을 실제 프론트 도메인 하나 또는 명시 목록으로 제한한다.
- [ ] localhost 값이 프로덕션에 남지 않도록 env 검증에 포함한다.
- [ ] credentials 요청이 필요한 이유와 허용 origin을 문서화한다.

관련 코드:

- `backend/src/main.ts`
- `backend/.env.example`

## P2 - 운영 안정성 및 감사

### 12. 로그와 민감정보 관리

- [ ] 요청 로그에 비밀번호, 세션 쿠키, 전화번호, 주소가 남지 않는지 확인한다.
- [ ] 에러 응답이 내부 예외 메시지나 DB 정보를 노출하지 않는지 확인한다.
- [ ] 운영 로그 레벨은 `info` 이상으로 둔다.

관련 코드:

- `backend/src/main.ts`
- `backend/src/common/filters/http-exception.filter.ts`

### 13. 공개 입력 크기 제한

- [ ] 전역 JSON body size limit을 명시한다.
- [ ] 주문 생성 items 개수 상한을 둔다.
- [ ] 공지/상품 설명 등 긴 텍스트 필드 상한이 충분히 검증되는지 확인한다.

관련 코드:

- `backend/src/main.ts`
- `backend/src/modules/store/dto/create-order.dto.ts`
- `backend/src/modules/admin/dto/admin-notice-content.dto.ts`

### 14. 배포 아티팩트 정리

- [ ] 실제 배포 플랫폼을 확정한다.
- [ ] 배포 설정 파일 또는 플랫폼 설정 문서를 레포에 남긴다.
- [ ] 백엔드/프론트 env 목록과 배포 secret 위치를 정리한다.
- [ ] DB migration 적용 방식과 Supabase direct/pooler 제약을 배포 절차에 포함한다.

현재 확인:

- 레포 안에 `Dockerfile`, `vercel.json`, `render.yaml`, `railway.json`, `fly.toml`, `.github/workflows`는 확인되지 않았다.
- 실제 `.env` 파일은 Git 추적 대상이 아니며 ignore 상태다.
- `frontend/.env`는 현재 localhost/development 계열 값이 남아 있어 배포용 env 교체가 필요하다.

## 완료 전 검증 명령

아래 명령은 관련 수정 후 반드시 실행한다.

```bash
npm --prefix backend run build
npm --prefix backend test
npm --prefix backend audit --omit=dev --audit-level=moderate
npm --prefix frontend run build
npm --prefix frontend audit --omit=dev --audit-level=moderate
```

루트에서 한 번에 확인할 때:

```bash
npm run check
```

## 진행 메모

- [ ] P0 항목 구현 전 API 계약 변경 범위를 확정한다.
- [x] 주문 조회 보호 방식 결정 후 프론트 주문조회 화면도 함께 수정한다.
- [ ] 관리자 보안 보강은 먼저 백엔드 정책을 넣고, 필요한 경우 프론트 API 클라이언트를 맞춘다.
- [ ] 배포 플랫폼이 확정되면 이 문서의 배포 아티팩트 섹션을 실제 플랫폼 기준으로 갱신한다.
