# Backend Test Checklist

이 문서는 백엔드 자동 테스트의 범위, 우선순위, 진행 상태를 기록한다.

## 1. 테스트 방향

프론트엔드는 현재 테스트 인프라가 거의 없고 수동 검증을 많이 진행했으므로, 당장은 수동 테스트를 유지한다.

백엔드는 아래 순서로 진행한다.

1. 단위 테스트
   - DB, 서버, 외부 API 없이 실행 가능한 핵심 로직 테스트
   - `domain`, `utils` 함수 중심
   - 빠르게 자주 실행하는 기본 안전망

2. 서비스 통합 테스트
   - Nest HTTP 서버는 띄우지 않고 service를 직접 호출
   - 실제 Prisma/DB transaction 흐름 검증
   - 주문 생성, 입금 요청, 커스텀 주문처럼 DB 상태가 중요한 기능 대상

3. API 통합 테스트
   - Nest 앱을 테스트 환경에서 띄우고 HTTP 요청으로 검증
   - DTO validation, controller, service, DB를 함께 확인
   - 꼭 필요한 핵심 API만 선별

4. E2E 테스트
   - 프론트까지 포함한 브라우저 흐름 테스트
   - 현재 단계에서는 보류

## 2. 기본 실행 명령

백엔드 단위 테스트:

```bash
npm --prefix backend test -- --runInBand
```

특정 테스트 파일만 실행:

```bash
npm --prefix backend test -- order-pricing.spec.ts --runInBand
```

테스트용 TypeScript 타입 체크:

```bash
cd backend
npm exec tsc -- --noEmit -p tsconfig.spec.json
```

백엔드 빌드:

```bash
npm --prefix backend run build
```

전체 기본 검증:

```bash
npm run check
```

## 3. 현재 단위 테스트 커버리지

- [x] 관리자 계정 관리
  - optional 문자열 정규화
  - 대표 입금계좌 필수값 검증
  - 파일: `backend/src/modules/admin/domain/admin-account-rules.spec.ts`

- [x] 상품 관리
  - 상품 이미지 sortOrder 기본값
  - 옵션 그룹/옵션 기본값
  - 파일: `backend/src/modules/admin/domain/admin-product-write.spec.ts`

- [x] 일반 주문 생성 보조 로직
  - 할인 가격 계산
  - 상품 합계, 배송비, 최종 금액 계산
  - KST 주문 날짜
  - 입금 기한 계산
  - 배송지 주소 정규화
  - 파일:
    - `backend/src/modules/store/domain/order-pricing.spec.ts`
    - `backend/src/modules/store/domain/order-deadline.spec.ts`
    - `backend/src/modules/store/utils/order-contact.util.spec.ts`

- [x] 커스텀 주문 링크
  - 만료 시각 파싱
  - checkout URL 생성
  - 사용 가능 여부 판단
  - 비활성/만료/사용 완료 링크 차단
  - 파일: `backend/src/modules/store/domain/custom-order-link.spec.ts`

- [x] 입금 확인 요청
  - 이미 처리된 요청 판단
  - 입금 대기 상태 요청 허용
  - 비허용 주문 상태 차단
  - 입금 요청 사유 생성
  - 파일: `backend/src/modules/store/domain/deposit-request.spec.ts`

- [x] 주문 상태 전이
  - 허용 전이
  - 금지 전이
  - 종료 상태 전이 차단
  - 허용 상태 목록 방어적 복사
  - 파일: `backend/src/modules/orders/domain/order-status-transition.spec.ts`

- [x] 주문 조회/트래킹
  - 배송 snapshot
  - tracking URL
  - tracking event 생성
  - 배송 이벤트 중복 방지
  - 상태 라벨
  - 파일: `backend/src/modules/store/domain/order-tracking.spec.ts`

- [x] 캐시
  - `getOrSet` hit/miss
  - TTL 만료
  - 단일 key 무효화
  - prefix 무효화
  - 파일: `backend/src/modules/store/store-cache.service.spec.ts`

- [x] 알림 템플릿
  - 신규 주문 이메일
  - 입금 확인 요청 SMS
  - 고객 상태 변경 SMS
  - HTML escape
  - 금액/상태 라벨
  - 파일: `backend/src/modules/notifications/notification-templates.spec.ts`

## 4. 통합 테스트 준비 원칙

통합 테스트는 실제 DB에 쓰기 때문에 아래 원칙을 지킨다.

- 테스트 데이터에는 명확한 prefix를 붙인다.
  - 예: `[TEST] 주문 통합 테스트 상품`
- 테스트가 만든 데이터는 `afterEach` 또는 `afterAll`에서 정리한다.
- 주문/상품/링크처럼 관계가 많은 데이터는 삭제 순서를 명시한다.
- 외부 알림 발송은 mock 또는 no-op 처리한다.
- 현재 개발 DB를 사용할 경우, 테스트 범위를 작게 유지하고 cleanup 실패를 바로 확인한다.
- 장기적으로는 별도 테스트 DB를 분리하는 것을 목표로 한다.

## 5. 서비스 통합 테스트 진행 순서

### 5.1 일반 주문 생성

- [ ] 테스트 fixture 생성
  - 카테고리
  - 상품
  - 상품 이미지
  - 옵션 그룹
  - 옵션
  - 대표 입금계좌 관리자 또는 기본 입금계좌 환경값

- [ ] `StoreService.createOrder(dto)` 호출

- [ ] 응답 검증
  - 주문번호 형식
  - 주문 상태 `PENDING_PAYMENT`
  - 상품 snapshot
  - 옵션 snapshot
  - 수량/옵션 추가금/최종 금액
  - 입금 정보
  - 입금 기한

- [ ] DB 검증
  - `Order` 생성
  - `OrderItem` 생성
  - `OrderItemOptionSelection` 생성
  - `OrderContact` 생성
  - `Deposit` 생성

- [ ] cleanup 검증

### 5.2 입금 확인 요청

- [ ] 주문 fixture 생성
  - `PENDING_PAYMENT` 주문
  - `WAITING` deposit

- [ ] `StoreService.createDepositRequest(orderNumber, dto)` 호출

- [ ] 응답 검증
  - `depositStatus`가 `REQUESTED`
  - `orderStatus`가 `PAYMENT_REQUESTED`
  - `requestAccepted`가 `true`

- [ ] DB 검증
  - `Deposit.requestedAt`
  - `Deposit.depositorName`
  - `Order.paymentRequestedAt`
  - `OrderStatusHistory`

- [ ] 이미 요청된 주문 재요청 케이스 검증
  - `requestAccepted`가 `false`

- [ ] 비허용 상태 차단 검증

- [ ] cleanup 검증

### 5.3 커스텀 주문 링크

- [ ] 관리자 fixture 생성

- [ ] `StoreService.createCustomOrderLink(adminId, dto)` 호출

- [ ] 링크 응답 검증
  - token
  - checkoutUrl
  - totalProductPrice
  - shippingFee
  - finalTotalPrice
  - expiresAt
  - isAvailable

- [ ] `StoreService.createCustomCheckoutOrder(token, dto)` 호출

- [ ] 주문 생성 검증
  - 커스텀 주문은 `items`가 비어 있음
  - 가격 snapshot이 링크 가격과 일치
  - 연락처/입금정보 생성

- [ ] 링크 사용 처리 검증
  - `usedAt`
  - `usedOrderId`
  - `usageCount`

- [ ] 만료/사용 완료 링크 차단 검증

- [ ] cleanup 검증

### 5.4 관리자 상품 생성

- [ ] 카테고리 fixture 생성

- [ ] `AdminService.createProduct(dto)` 호출

- [ ] 응답 검증
  - 상품 기본 필드
  - 이미지 정렬
  - 옵션 그룹 정렬
  - 옵션 기본값

- [ ] DB 검증
  - `Product`
  - `ProductImage`
  - `ProductOptionGroup`
  - `ProductOption`

- [ ] 캐시 무효화 호출 검증
  - `store:products:`
  - `store:product-detail:`

- [ ] cleanup 검증

### 5.5 주문 조회/트래킹

- [ ] 주문 fixture 생성
  - contact
  - deposit
  - shipment
  - status history

- [ ] `StoreService.getOrderByOrderNumber(orderNumber)` 호출

- [ ] 주문 상세 응답 검증
  - 연락처
  - 가격
  - 입금 정보
  - 배송 snapshot
  - trackingEvents

- [ ] `StoreService.getOrderTracking(orderNumber)` 호출

- [ ] 트래킹 응답 검증
  - orderStatus
  - shipmentStatus
  - trackingUrl
  - events 정렬

- [ ] cleanup 검증

## 6. API 통합 테스트 후보

서비스 통합 테스트가 안정화된 뒤 아래 API만 선별해서 진행한다.

- [ ] `POST /api/v1/store/orders`
- [ ] `GET /api/v1/store/orders/:orderNumber`
- [ ] `POST /api/v1/store/orders/:orderNumber/deposit-requests`
- [ ] `GET /api/v1/store/orders/:orderNumber/tracking`
- [ ] `POST /api/v1/admin/custom-orders/links`
- [ ] `POST /api/v1/store/custom-checkout/:token/orders`

API 통합 테스트에서 확인할 것:

- DTO validation
- HTTP status code
- response body shape
- session/auth guard가 필요한 API의 인증 흐름
- service 통합 테스트와 중복되는 세부 DB 검증은 최소화

## 7. 보류 항목

아래 항목은 현재 단계에서 우선순위를 낮춘다.

- 프론트 자동 테스트
- 브라우저 E2E 테스트
- 전체 관리자 CRUD 통합 테스트
- 외부 알림 실제 발송 테스트
- Cloudinary/SMS/Email 실제 API 연동 테스트

## 8. 최근 검증 상태

마지막 확인 기준:

- [x] `npm --prefix backend test -- --runInBand`
- [x] `cd backend && npm exec tsc -- --noEmit -p tsconfig.spec.json`
- [x] `npm --prefix backend run build`

현재 자동 테스트 기준:

- 테스트 파일: 11개
- 테스트 케이스: 43개
