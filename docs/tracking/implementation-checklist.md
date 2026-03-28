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

## 전체 진행 현황

- [x] M01 프로젝트 베이스 셋업
- [x] M02 DB 마이그레이션/스키마 반영
- [x] M03 관리자 인증(세션)
- [ ] M04 스토어 카탈로그 조회 API
- [ ] M05 스토어 주문 생성 API
- [ ] M06 스토어 주문 조회/입금요청 API
- [ ] M07 관리자 카테고리/상품 관리 API
- [ ] M08 관리자 주문/상태/배송 관리 API
- [ ] M09 커스텀 주문 링크 API
- [ ] M10 내부 알림 연동 API
- [ ] M11 테스트/검증/문서 동기화

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

### M04 스토어 카탈로그 조회 API

- 상태: `TODO`
- 완료일: `-`
- 비고: `-`
- 완료 조건:
  - [ ] `GET /store/categories`
  - [ ] `GET /store/products`
  - [ ] `GET /store/products/{productId}`

### M05 스토어 주문 생성 API

- 상태: `TODO`
- 완료일: `-`
- 비고: `-`
- 완료 조건:
  - [ ] `POST /store/orders`
  - [ ] 주문번호 생성 규칙 반영
  - [ ] 주문/주문상품/연락처/입금정보 트랜잭션 반영

### M06 스토어 주문 조회/입금요청 API

- 상태: `TODO`
- 완료일: `-`
- 비고: `-`
- 완료 조건:
  - [ ] `GET /store/orders/{orderNumber}`
  - [ ] `POST /store/orders/{orderNumber}/deposit-requests`
  - [ ] `GET /store/orders/{orderNumber}/tracking`

### M07 관리자 카테고리/상품 관리 API

- 상태: `TODO`
- 완료일: `-`
- 비고: `-`
- 완료 조건:
  - [ ] 카테고리 CRUD (`/admin/categories`)
  - [ ] 상품 CRUD (`/admin/products`)
  - [ ] 상품 soft delete 정책 반영

### M08 관리자 주문/상태/배송 관리 API

- 상태: `TODO`
- 완료일: `-`
- 비고: `-`
- 완료 조건:
  - [ ] `GET /admin/orders`
  - [ ] `GET /admin/orders/{orderId}`
  - [ ] `PATCH /admin/orders/{orderId}/status`
  - [ ] `PATCH /admin/orders/{orderId}/shipment`
  - [ ] 상태변경 이력 기록 + 알림 큐 트리거

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
