# DODOMIII MARKET - 구현 체크리스트

- 버전: v1.0
- 기준일: 2026-03-27
- 기준 문서:
  - `docs/reference/db-schema.md`
  - `docs/reference/api-endpoints.md`

## 사용 규칙

- 각 모듈 구현 완료 시 체크박스를 `[x]`로 변경한다.
- 체크 시 `완료일`과 `비고`를 함께 작성한다.
- 구현 도중 스코프 변경이 생기면 `추가 작업` 섹션에 즉시 기록한다.
- 모듈 테스트 절차는 `docs/reference/module-test-playbook.md`를 기준으로 수행한다.

## 전체 진행 현황

- [x] M01 프로젝트 베이스 셋업
- [x] M02 DB 마이그레이션/스키마 반영
- [x] M03 관리자 인증(세션)
- [x] M04 스토어 카탈로그 조회 API
- [x] M05 스토어 주문 생성 API
- [x] M06 스토어 주문 조회/입금요청 API
- [x] M07 관리자 카테고리/상품 관리 API
- [x] M08 관리자 주문/상태/배송 관리 API
- [ ] M09 커스텀 주문 링크 API
- [ ] M10 내부 알림 연동 API
- [ ] M11 테스트/검증/문서 동기화

## 프론트 진행 현황

- [x] F01 프론트 베이스 라우팅/레이아웃
- [x] F03 관리자 인증 UI (M03 연동)
- [x] F04 스토어 카탈로그 UI (M04 연동)
- [x] F05 스토어 주문 UI (M05~M06 연동)
- [ ] F07 관리자 운영 UI (M07~M09 연동, 2차(M08) 완료)
- [ ] F11 프론트 테스트/배포 점검

## 모듈 상세

### M01 프로젝트 베이스 셋업

- 상태: `DONE`
- 완료일: `2026-03-28`
- 비고: `frontend/backend 기본 골격 생성 + .env.example 정리 + 글로벌 예외 필터/로깅 골격 구성 + frontend/backend 빌드 검증 완료`
- 완료 조건:
  - [x] 런타임/프레임워크 구조 확정
  - [x] 환경변수 템플릿 정리
  - [x] 공통 에러 응답 포맷/로깅 기본 골격 구성

### M02 DB 마이그레이션/스키마 반영

- 상태: `DONE`
- 완료일: `2026-03-29`
- 비고: `Prisma 스키마/마이그레이션 추가, Supabase 배포 적용 완료, 주문 상태 전이 검증 초안 추가`
- 완료 조건:
  - [x] `categories` ~ `admins`까지 핵심 테이블 반영
  - [x] FK/UNIQUE/INDEX 반영
  - [x] 주문 상태 enum 및 전이 검증 레이어 초안 반영

### M03 관리자 인증(세션)

- 상태: `DONE`
- 완료일: `2026-03-29`
- 비고: `세션 기반 관리자 인증 모듈 구현, login/logout/me API 추가, AdminSessionGuard 추가, bcrypt 검증 적용`
- 완료 조건:
  - [x] `POST /admin/auth/login`
  - [x] `POST /admin/auth/logout`
  - [x] `GET /admin/auth/me`

### F03 관리자 인증 UI (M03 연동)

- 상태: `DONE`
- 완료일: `2026-03-29`
- 비고: `admin/login, admin 대시보드 라우트 추가, login/logout/me API 연동, 세션 기반 보호 흐름 반영`
- 완료 조건:
  - [x] `/admin/login` 로그인 화면
  - [x] `/admin` 세션 확인(me) 기반 보호 화면
  - [x] 로그아웃 동작 및 에러 처리

### M04 스토어 카탈로그 조회 API

- 상태: `DONE`
- 완료일: `2026-03-29`
- 비고: `store 모듈 추가, categories/products/products/:id API 구현, 필터/정렬/페이지네이션/노출조건 반영, 검증: backend build OK`
- 완료 조건:
  - [x] `GET /store/categories`
  - [x] `GET /store/products`
  - [x] `GET /store/products/{productId}`

### F04 스토어 카탈로그 UI (M04 연동)

- 상태: `DONE`
- 완료일: `2026-03-29`
- 비고: `상품 목록(/products), 상세(/products/:productId), 검색/정렬/카테고리 필터/페이지네이션 UI 추가, 검증: frontend build OK`
- 완료 조건:
  - [x] 상품 목록 화면
  - [x] 상품 상세 화면
  - [x] 카테고리/검색/정렬/페이지네이션 연동

### M05 스토어 주문 생성 API

- 상태: `DONE`
- 완료일: `2026-03-29`
- 비고: `POST /store/orders 구현, 주문번호 생성(DMYYYYMMDD-####) 및 주문/주문상품/연락처/입금 트랜잭션 반영, 검증: backend build OK`
- 완료 조건:
  - [x] `POST /store/orders`
  - [x] 주문번호 생성 규칙 반영
  - [x] 주문/주문상품/연락처/입금정보 트랜잭션 반영

### M06 스토어 주문 조회/입금요청 API

- 상태: `DONE`
- 완료일: `2026-03-29`
- 비고: `주문번호 기반 조회/입금확인요청/트래킹 API 구현, 상태전이/멱등 처리 반영, 검증: backend build OK`
- 완료 조건:
  - [x] `GET /store/orders/{orderNumber}`
  - [x] `POST /store/orders/{orderNumber}/deposit-requests`
  - [x] `GET /store/orders/{orderNumber}/tracking`

### F05 스토어 주문 UI (M05~M06 연동)

- 상태: `DONE`
- 완료일: `2026-03-29`
- 비고: `주문서 생성 + 주문번호 조회(/orders) + 입금확인요청 + 트래킹 타임라인 UI 연동 완료, 검증: frontend build OK`
- 완료 조건:
  - [x] 상품 상세 -> 주문서 이동 흐름
  - [x] 주문서 입력/검증/주문 생성 API 연동
  - [x] 주문번호 조회/입금확인요청/트래킹 연동

### M07 관리자 카테고리/상품 관리 API

- 상태: `DONE`
- 완료일: `2026-03-29`
- 비고: `AdminModule 추가, 카테고리/상품 관리자 CRUD 구현, 상품 soft delete(deletedAt) 반영, 검증: backend build OK`
- 완료 조건:
  - [x] 카테고리 CRUD (`/admin/categories`)
  - [x] 상품 CRUD (`/admin/products`)
  - [x] 상품 soft delete 정책 반영

### F07 관리자 운영 UI (M07~M09 연동)

- 상태: `IN_PROGRESS`
- 완료일: `2026-03-29 (2차)`
- 비고: `관리자 대시보드/사이드바, 카테고리 트리형 관리 UI, 상품 목록/편집 UX + 주문 목록/상세/상태변경/배송수정 UI 반영. 현재 M07~M08 연동 완료, M09 연동 대기`
- 완료 조건:
  - [x] 관리자 카테고리 관리 UI (`/admin/categories`) + M07 연동
  - [x] 관리자 상품 관리 UI (`/admin/products`, `/admin/products/new`, `/admin/products/:productId`) + M07 연동
  - [x] 관리자 주문/상태/배송 운영 UI (M08 연동)
  - [ ] 커스텀 주문 링크 운영 UI (M09 연동)

### M08 관리자 주문/상태/배송 관리 API

- 상태: `DONE`
- 완료일: `2026-03-29`
- 비고: `관리자 주문 목록/상세 조회, 상태 변경, 배송 정보 수정 API 구현. 상태전이 검증 + 상태이력 기록 + 알림 훅(placeholder) 반영, 검증: backend build OK`
- 완료 조건:
  - [x] `GET /admin/orders`
  - [x] `GET /admin/orders/{orderId}`
  - [x] `PATCH /admin/orders/{orderId}/status`
  - [x] `PATCH /admin/orders/{orderId}/shipment`
  - [x] 상태변경 이력 기록 + 알림 큐 트리거

### M09 커스텀 주문 링크 API

- 상태: `TODO`
- 완료일: `-`
- 비고: `-`
- 완료 조건:
  - [ ] `POST /admin/custom-orders/links`
  - [ ] `GET /admin/custom-orders/links/{linkId}`
  - [ ] `GET /store/custom-checkout/{token}`
  - [ ] `POST /store/custom-checkout/{token}/orders`

### M10 내부 알림 연동 API

- 상태: `TODO`
- 완료일: `-`
- 비고: `-`
- 완료 조건:
  - [ ] `POST /internal/notifications/order-status-changed`
  - [ ] `POST /internal/emails/new-order`
  - [ ] 큐 실패 재시도/로깅 정책 기본 반영

### M11 테스트/검증/문서 동기화

- 상태: `TODO`
- 완료일: `-`
- 비고: `-`
- 완료 조건:
  - [ ] 모듈별 기본 단위 테스트
  - [ ] 핵심 시나리오 통합 테스트(주문 생성→입금요청→상태변경→배송)
  - [ ] `docs/reference` 문서와 구현 차이 동기화

## 추가 작업

- `DIRECT_URL`을 direct host 대신 pooler로 임시 설정한 상태이므로, 추후 direct 연결 재검증 필요
