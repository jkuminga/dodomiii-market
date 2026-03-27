# DODOMIII MARKET - API 엔드포인트 명세서

- 버전: v1.0 (MVP)
- 작성일: 2026-03-27
- 기준 문서: `docs/reference/db-schema.md`, Notion `MVP 설정`, Notion `사용자 플로우 정의`
- Base URL: `/api/v1`
- Content-Type: `application/json; charset=utf-8`

## 1) 공통 규약

### 1.1 인증

- 사용자(스토어) API: 비인증
- 관리자 API: 세션 쿠키 기반 인증
- 관리자 인증 쿠키명: `admin_session`

### 1.2 공통 응답 포맷

#### 성공

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

#### 실패

```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "주문번호를 찾을 수 없습니다.",
    "details": {}
  }
}
```

### 1.3 공통 타입

```ts
type ISODateTime = string;
type Money = number; // KRW, 정수

type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_REQUESTED'
  | 'PAYMENT_CONFIRMED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'EXPIRED';

type DepositStatus = 'WAITING' | 'REQUESTED' | 'CONFIRMED' | 'REJECTED';
type ShipmentStatus = 'READY' | 'SHIPPED' | 'DELIVERED';
type AdminRole = 'SUPER' | 'STAFF';
```

### 1.4 페이지네이션

- 요청 쿼리: `page`(기본 1), `size`(기본 20, 최대 100)
- 응답 `meta`:

```json
{
  "page": 1,
  "size": 20,
  "totalItems": 132,
  "totalPages": 7
}
```

## 2) 사용자(스토어) API

## 2.1 카테고리 조회

### GET `/store/categories`

- 설명: 노출 가능한 카테고리 트리 조회

응답 스키마:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "parentId": null,
        "name": "꽃다발",
        "slug": "bouquet",
        "sortOrder": 0,
        "children": []
      }
    ]
  }
}
```

## 2.2 상품 목록 조회

### GET `/store/products`

쿼리:
- `categorySlug?`: string
- `q?`: string (상품명 검색)
- `sort?`: `latest|price_asc|price_desc`
- `page?`: number
- `size?`: number

응답 스키마:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 101,
        "categoryId": 1,
        "categoryName": "꽃다발",
        "name": "모루 튤립 꽃다발",
        "slug": "moru-tulip-bouquet",
        "shortDescription": "핸드메이드 모루 꽃다발",
        "basePrice": 29000,
        "isSoldOut": false,
        "consultationRequired": true,
        "thumbnailImageUrl": "https://cdn.example.com/p/101-thumb.jpg"
      }
    ]
  },
  "meta": {
    "page": 1,
    "size": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

## 2.3 상품 상세 조회

### GET `/store/products/{productId}`

응답 스키마:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "categoryId": 1,
    "categoryName": "꽃다발",
    "name": "모루 튤립 꽃다발",
    "slug": "moru-tulip-bouquet",
    "shortDescription": "핸드메이드 모루 꽃다발",
    "description": "상세 설명",
    "basePrice": 29000,
    "isSoldOut": false,
    "consultationRequired": true,
    "stockQuantity": 12,
    "images": [
      {
        "id": 10,
        "imageType": "THUMBNAIL",
        "imageUrl": "https://cdn.example.com/p/101-thumb.jpg",
        "sortOrder": 0
      }
    ],
    "options": [
      {
        "id": 2001,
        "optionGroupName": "색상",
        "optionValue": "핑크",
        "extraPrice": 1000,
        "isActive": true,
        "sortOrder": 0
      }
    ],
    "policy": {
      "shippingInfo": "배송 안내 텍스트",
      "refundInfo": "교환/환불 안내 텍스트"
    }
  }
}
```

## 2.4 주문 생성 (즉시구매)

### POST `/store/orders`

요청 스키마:

```json
{
  "items": [
    {
      "productId": 101,
      "productOptionId": 2001,
      "quantity": 1
    }
  ],
  "contact": {
    "buyerName": "홍길동",
    "buyerPhone": "01012345678",
    "receiverName": "홍길동",
    "receiverPhone": "01012345678",
    "zipcode": "06236",
    "address1": "서울특별시 강남구 ...",
    "address2": "101동 202호"
  },
  "customerRequest": "문 앞에 놓아주세요"
}
```

응답 스키마:

```json
{
  "success": true,
  "data": {
    "orderId": 5001,
    "orderNumber": "DM20260327-0001",
    "orderStatus": "PENDING_PAYMENT",
    "items": [
      {
        "productId": 101,
        "productOptionId": 2001,
        "productNameSnapshot": "모루 튤립 꽃다발",
        "optionNameSnapshot": "색상",
        "optionValueSnapshot": "핑크",
        "unitPrice": 30000,
        "quantity": 1,
        "lineTotalPrice": 30000
      }
    ],
    "pricing": {
      "totalProductPrice": 30000,
      "shippingFee": 3000,
      "finalTotalPrice": 33000
    },
    "depositInfo": {
      "bankName": "국민은행",
      "accountHolder": "도도미마켓",
      "accountNumber": "000-00-000000",
      "expectedAmount": 33000,
      "depositStatus": "WAITING",
      "depositDeadlineAt": "2026-03-28T23:59:59+09:00"
    },
    "createdAt": "2026-03-27T17:00:00+09:00"
  }
}
```

## 2.5 주문 조회 (주문번호)

### GET `/store/orders/{orderNumber}`

응답 스키마:

```json
{
  "success": true,
  "data": {
    "orderNumber": "DM20260327-0001",
    "orderStatus": "PAYMENT_CONFIRMED",
    "items": [
      {
        "productNameSnapshot": "모루 튤립 꽃다발",
        "optionNameSnapshot": "색상",
        "optionValueSnapshot": "핑크",
        "unitPrice": 30000,
        "quantity": 1,
        "lineTotalPrice": 30000
      }
    ],
    "contact": {
      "buyerName": "홍길동",
      "buyerPhone": "01012345678",
      "receiverName": "홍길동",
      "receiverPhone": "01012345678",
      "zipcode": "06236",
      "address1": "서울특별시 강남구 ...",
      "address2": "101동 202호"
    },
    "pricing": {
      "totalProductPrice": 30000,
      "shippingFee": 3000,
      "finalTotalPrice": 33000
    },
    "deposit": {
      "depositStatus": "CONFIRMED",
      "requestedAt": "2026-03-27T17:01:00+09:00",
      "confirmedAt": "2026-03-27T17:15:00+09:00"
    },
    "shipment": {
      "shipmentStatus": "READY",
      "courierName": null,
      "trackingNumber": null,
      "trackingUrl": null,
      "shippedAt": null,
      "deliveredAt": null
    },
    "updatedAt": "2026-03-27T17:15:00+09:00"
  }
}
```

## 2.6 입금 확인 요청

### POST `/store/orders/{orderNumber}/deposit-requests`

요청 스키마:

```json
{
  "depositorName": "홍길동",
  "memo": "17시 10분 입금"
}
```

응답 스키마:

```json
{
  "success": true,
  "data": {
    "orderNumber": "DM20260327-0001",
    "depositStatus": "REQUESTED",
    "requestedAt": "2026-03-27T17:10:00+09:00"
  }
}
```

## 2.7 운송장 조회

### GET `/store/orders/{orderNumber}/tracking`

응답 스키마:

```json
{
  "success": true,
  "data": {
    "orderNumber": "DM20260327-0001",
    "shipmentStatus": "SHIPPED",
    "courierName": "CJ대한통운",
    "trackingNumber": "1234567890",
    "trackingUrl": "https://tracker.example.com/1234567890",
    "shippedAt": "2026-03-28T09:00:00+09:00",
    "deliveredAt": null
  }
}
```

## 2.8 커스텀 주문 URL 조회

### GET `/store/custom-checkout/{token}`

응답 스키마:

```json
{
  "success": true,
  "data": {
    "token": "cus_9f6a1d...",
    "productName": "커스텀 꽃다발",
    "finalTotalPrice": 55000,
    "expiresAt": "2026-03-30T23:59:59+09:00",
    "isExpired": false
  }
}
```

## 2.9 커스텀 주문 생성

### POST `/store/custom-checkout/{token}/orders`

요청 스키마:

```json
{
  "contact": {
    "buyerName": "홍길동",
    "buyerPhone": "01012345678",
    "receiverName": "홍길동",
    "receiverPhone": "01012345678",
    "zipcode": "06236",
    "address1": "서울특별시 강남구 ...",
    "address2": "101동 202호"
  },
  "customerRequest": "리본은 흰색으로 부탁드립니다"
}
```

응답 스키마:

```json
{
  "success": true,
  "data": {
    "orderId": 5012,
    "orderNumber": "DM20260327-0012",
    "orderStatus": "PENDING_PAYMENT",
    "pricing": {
      "totalProductPrice": 55000,
      "shippingFee": 3000,
      "finalTotalPrice": 58000
    },
    "depositInfo": {
      "bankName": "국민은행",
      "accountHolder": "도도미마켓",
      "accountNumber": "000-00-000000",
      "expectedAmount": 58000,
      "depositStatus": "WAITING",
      "depositDeadlineAt": "2026-03-28T23:59:59+09:00"
    }
  }
}
```

## 3) 관리자 API

## 3.1 인증

### POST `/admin/auth/login`

요청 스키마:

```json
{
  "loginId": "admin",
  "password": "plaintext-password"
}
```

응답 스키마:

```json
{
  "success": true,
  "data": {
    "admin": {
      "adminId": 1,
      "loginId": "admin",
      "name": "관리자",
      "role": "SUPER"
    }
  }
}
```

### POST `/admin/auth/logout`

응답 스키마:

```json
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}
```

### GET `/admin/auth/me`

응답 스키마:

```json
{
  "success": true,
  "data": {
    "adminId": 1,
    "loginId": "admin",
    "name": "관리자",
    "role": "SUPER",
    "isActive": true
  }
}
```

## 3.2 카테고리 관리

### GET `/admin/categories`

응답 스키마:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "parentId": null,
        "name": "꽃다발",
        "slug": "bouquet",
        "sortOrder": 0,
        "isVisible": true,
        "createdAt": "2026-03-27T12:00:00+09:00",
        "updatedAt": "2026-03-27T12:00:00+09:00"
      }
    ]
  }
}
```

### POST `/admin/categories`

요청 스키마:

```json
{
  "parentId": null,
  "name": "꽃다발",
  "slug": "bouquet",
  "sortOrder": 0,
  "isVisible": true
}
```

응답 스키마:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "parentId": null,
    "name": "꽃다발",
    "slug": "bouquet",
    "sortOrder": 0,
    "isVisible": true,
    "createdAt": "2026-03-27T12:00:00+09:00",
    "updatedAt": "2026-03-27T12:00:00+09:00"
  }
}
```

### PATCH `/admin/categories/{categoryId}`

요청 스키마:

```json
{
  "name": "꽃다발(수정)",
  "slug": "bouquet-new",
  "sortOrder": 1,
  "isVisible": true
}
```

응답 스키마: `POST /admin/categories`와 동일

### DELETE `/admin/categories/{categoryId}`

응답 스키마:

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

## 3.3 상품 관리

### GET `/admin/products`

쿼리:
- `categoryId?`: number
- `q?`: string
- `isVisible?`: boolean
- `isSoldOut?`: boolean
- `page?`: number
- `size?`: number

응답 스키마:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 101,
        "categoryId": 1,
        "name": "모루 튤립 꽃다발",
        "slug": "moru-tulip-bouquet",
        "basePrice": 29000,
        "isVisible": true,
        "isSoldOut": false,
        "consultationRequired": true,
        "stockQuantity": 12,
        "createdAt": "2026-03-27T12:00:00+09:00",
        "updatedAt": "2026-03-27T12:00:00+09:00"
      }
    ]
  },
  "meta": {
    "page": 1,
    "size": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### POST `/admin/products`

요청 스키마:

```json
{
  "categoryId": 1,
  "name": "모루 튤립 꽃다발",
  "slug": "moru-tulip-bouquet",
  "shortDescription": "핸드메이드 모루 꽃다발",
  "description": "상세 설명",
  "basePrice": 29000,
  "isVisible": true,
  "isSoldOut": false,
  "consultationRequired": true,
  "stockQuantity": 12,
  "images": [
    {
      "imageType": "THUMBNAIL",
      "imageUrl": "https://cdn.example.com/p/101-thumb.jpg",
      "sortOrder": 0
    }
  ],
  "options": [
    {
      "optionGroupName": "색상",
      "optionValue": "핑크",
      "extraPrice": 1000,
      "isActive": true,
      "sortOrder": 0
    }
  ]
}
```

응답 스키마:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "createdAt": "2026-03-27T12:00:00+09:00",
    "updatedAt": "2026-03-27T12:00:00+09:00"
  }
}
```

### GET `/admin/products/{productId}`

응답 스키마: `GET /store/products/{productId}`와 동일 + `isVisible`, `deletedAt`

### PATCH `/admin/products/{productId}`

요청 스키마: `POST /admin/products`와 동일(부분 수정 허용)

응답 스키마:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "updatedAt": "2026-03-27T12:30:00+09:00"
  }
}
```

### DELETE `/admin/products/{productId}`

- 동작: soft delete (`products.deleted_at` 업데이트)

응답 스키마:

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "deletedAt": "2026-03-27T12:40:00+09:00"
  }
}
```

## 3.4 주문 관리

### GET `/admin/orders`

쿼리:
- `orderStatus?`: `OrderStatus`
- `orderNumber?`: string
- `buyerName?`: string
- `buyerPhone?`: string
- `dateFrom?`: ISODateTime
- `dateTo?`: ISODateTime
- `page?`: number
- `size?`: number

응답 스키마:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "orderId": 5001,
        "orderNumber": "DM20260327-0001",
        "orderStatus": "PAYMENT_REQUESTED",
        "buyerName": "홍길동",
        "buyerPhone": "01012345678",
        "finalTotalPrice": 33000,
        "depositStatus": "REQUESTED",
        "shipmentStatus": "READY",
        "createdAt": "2026-03-27T17:00:00+09:00",
        "updatedAt": "2026-03-27T17:10:00+09:00"
      }
    ]
  },
  "meta": {
    "page": 1,
    "size": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### GET `/admin/orders/{orderId}`

응답 스키마:

```json
{
  "success": true,
  "data": {
    "orderId": 5001,
    "orderNumber": "DM20260327-0001",
    "orderStatus": "PAYMENT_REQUESTED",
    "customerRequest": "문 앞에 놓아주세요",
    "pricing": {
      "totalProductPrice": 30000,
      "shippingFee": 3000,
      "finalTotalPrice": 33000
    },
    "contact": {
      "buyerName": "홍길동",
      "buyerPhone": "01012345678",
      "receiverName": "홍길동",
      "receiverPhone": "01012345678",
      "zipcode": "06236",
      "address1": "서울특별시 강남구 ...",
      "address2": "101동 202호"
    },
    "items": [
      {
        "orderItemId": 8001,
        "productId": 101,
        "productOptionId": 2001,
        "productNameSnapshot": "모루 튤립 꽃다발",
        "optionNameSnapshot": "색상",
        "optionValueSnapshot": "핑크",
        "unitPrice": 30000,
        "quantity": 1,
        "lineTotalPrice": 30000
      }
    ],
    "deposit": {
      "depositStatus": "REQUESTED",
      "bankName": "국민은행",
      "accountHolder": "도도미마켓",
      "accountNumber": "000-00-000000",
      "expectedAmount": 33000,
      "depositorName": "홍길동",
      "requestedAt": "2026-03-27T17:10:00+09:00",
      "confirmedAt": null,
      "adminMemo": null
    },
    "shipment": {
      "shipmentStatus": "READY",
      "courierName": null,
      "trackingNumber": null,
      "shippedAt": null,
      "deliveredAt": null
    },
    "statusHistories": [
      {
        "orderStatusHistoryId": 9001,
        "previousStatus": "PENDING_PAYMENT",
        "newStatus": "PAYMENT_REQUESTED",
        "changeReason": "입금 요청 접수",
        "changedByAdminId": 1,
        "createdAt": "2026-03-27T17:10:00+09:00"
      }
    ],
    "createdAt": "2026-03-27T17:00:00+09:00",
    "updatedAt": "2026-03-27T17:10:00+09:00"
  }
}
```

### PATCH `/admin/orders/{orderId}/status`

요청 스키마:

```json
{
  "newStatus": "PAYMENT_CONFIRMED",
  "changeReason": "입금 확인 완료",
  "notifyCustomer": true
}
```

응답 스키마:

```json
{
  "success": true,
  "data": {
    "orderId": 5001,
    "previousStatus": "PAYMENT_REQUESTED",
    "newStatus": "PAYMENT_CONFIRMED",
    "orderStatusHistoryId": 9002,
    "changedAt": "2026-03-27T17:15:00+09:00",
    "notificationQueued": true
  }
}
```

### PATCH `/admin/orders/{orderId}/shipment`

요청 스키마:

```json
{
  "courierName": "CJ대한통운",
  "trackingNumber": "1234567890",
  "markAsShipped": true
}
```

응답 스키마:

```json
{
  "success": true,
  "data": {
    "orderId": 5001,
    "shipmentStatus": "SHIPPED",
    "courierName": "CJ대한통운",
    "trackingNumber": "1234567890",
    "trackingUrl": "https://tracker.example.com/1234567890",
    "shippedAt": "2026-03-28T09:00:00+09:00",
    "updatedAt": "2026-03-28T09:00:00+09:00"
  }
}
```

## 3.5 커스텀 주문 링크 관리

### POST `/admin/custom-orders/links`

요청 스키마:

```json
{
  "finalTotalPrice": 55000,
  "shippingFee": 3000,
  "note": "오픈채팅 협의건",
  "expiresAt": "2026-03-30T23:59:59+09:00"
}
```

응답 스키마:

```json
{
  "success": true,
  "data": {
    "linkId": 71,
    "token": "cus_9f6a1d...",
    "checkoutUrl": "https://dodomiii.com/custom-checkout/cus_9f6a1d...",
    "finalTotalPrice": 55000,
    "shippingFee": 3000,
    "expiresAt": "2026-03-30T23:59:59+09:00",
    "createdAt": "2026-03-27T18:00:00+09:00"
  }
}
```

### GET `/admin/custom-orders/links/{linkId}`

응답 스키마:

```json
{
  "success": true,
  "data": {
    "linkId": 71,
    "token": "cus_9f6a1d...",
    "checkoutUrl": "https://dodomiii.com/custom-checkout/cus_9f6a1d...",
    "finalTotalPrice": 55000,
    "shippingFee": 3000,
    "isUsed": false,
    "usedOrderId": null,
    "expiresAt": "2026-03-30T23:59:59+09:00",
    "createdAt": "2026-03-27T18:00:00+09:00"
  }
}
```

## 4) 내부 연동 API (MVP)

## 4.1 주문 상태 변경 알림 큐 등록

### POST `/internal/notifications/order-status-changed`

요청 스키마:

```json
{
  "orderId": 5001,
  "orderNumber": "DM20260327-0001",
  "newStatus": "SHIPPED",
  "receiverPhone": "01012345678",
  "trackingUrl": "https://tracker.example.com/1234567890"
}
```

응답 스키마:

```json
{
  "success": true,
  "data": {
    "queued": true,
    "queueMessageId": "msg_abc123"
  }
}
```

## 4.2 신규 주문 관리자 메일 큐 등록

### POST `/internal/emails/new-order`

요청 스키마:

```json
{
  "orderId": 5001,
  "orderNumber": "DM20260327-0001",
  "finalTotalPrice": 33000,
  "createdAt": "2026-03-27T17:00:00+09:00"
}
```

응답 스키마:

```json
{
  "success": true,
  "data": {
    "queued": true,
    "queueMessageId": "msg_def456"
  }
}
```

## 5) 상태 전이 정책

- 허용 전이:
1. `PENDING_PAYMENT -> PAYMENT_REQUESTED`
2. `PAYMENT_REQUESTED -> PAYMENT_CONFIRMED`
3. `PAYMENT_CONFIRMED -> PREPARING`
4. `PREPARING -> SHIPPED`
5. `SHIPPED -> DELIVERED`
6. `PENDING_PAYMENT -> EXPIRED`
7. `PENDING_PAYMENT|PAYMENT_REQUESTED|PAYMENT_CONFIRMED|PREPARING -> CANCELLED`

- 차단 전이 예시:
1. `DELIVERED -> PREPARING`
2. `CANCELLED -> PAYMENT_CONFIRMED`
3. `EXPIRED -> PAYMENT_CONFIRMED`

## 6) 에러 코드

- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `ORDER_NOT_FOUND` (404)
- `PRODUCT_NOT_FOUND` (404)
- `CATEGORY_SLUG_DUPLICATED` (409)
- `INVALID_STATUS_TRANSITION` (409)
- `OUT_OF_STOCK` (409)
- `CUSTOM_CHECKOUT_EXPIRED` (410)
- `INTERNAL_ERROR` (500)

## 7) DB 매핑 요약

- `categories` <-> 카테고리 API
- `products`, `product_images`, `product_options` <-> 상품 API
- `orders`, `order_items`, `order_contacts` <-> 주문 생성/조회 API
- `deposits` <-> 입금 요청/확인 API
- `shipments` <-> 배송 등록/조회 API
- `order_status_histories` <-> 상태 변경 히스토리 API
- `admins` <-> 관리자 인증/권한 API

## 8) 구현 시 주의사항

- `order_number`는 외부 노출 식별자이므로 내부 PK(`orders.id`)와 분리해서 사용한다.
- 사용자 주문 조회는 `orderNumber` 기반으로만 허용한다.
- 상품 삭제는 물리 삭제가 아니라 `deleted_at` 기반 soft delete를 기본으로 한다.
- 상태 변경 시 `orders`와 `order_status_histories`를 한 트랜잭션으로 처리한다.
- `shipments`, `deposits`는 `order_id` 유니크 제약으로 1:1 관계를 유지한다.
