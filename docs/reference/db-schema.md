# DODOMIII MARKET - DB 설계 기준서

이 문서는 구현 중 항상 참조하는 **단일 기준(Single Source of Truth)** DB 설계 문서다.

- 버전: v0.1
- 기준일: 2026-03-27
- 출처: Notion `쇼핑몰 홈페이지 만들기 > DB 설계`

## 1) ERD 개요

```text
categories
  └─ products
      ├─ product_images
      └─ product_options

orders
  ├─ order_items
  ├─ order_contacts
  ├─ deposits
  ├─ shipments
  └─ order_status_histories

admins
  └─ order_status_histories
```

## 2) 도메인 규칙

- 카테고리 `slug`는 **같은 부모 카테고리 내에서만 유일**하다.
- 상품은 기본적으로 `consultation_required = true`로 시작한다.
- 주문 상태는 아래 순서를 기본 흐름으로 본다.
  - `PENDING_PAYMENT -> PAYMENT_REQUESTED -> PAYMENT_CONFIRMED -> PREPARING -> SHIPPED -> DELIVERED`
- 종료 상태
  - `CANCELLED`, `EXPIRED`

## 3) Enum 정의

### 주문 상태 (`orders.order_status`)

- `PENDING_PAYMENT`
- `PAYMENT_REQUESTED`
- `PAYMENT_CONFIRMED`
- `PREPARING`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`
- `EXPIRED`

### 입금 상태 (`deposits.deposit_status`)

- `WAITING`
- `REQUESTED`
- `CONFIRMED`
- `REJECTED`

### 배송 상태 (`shipments.shipment_status`)

- `READY`
- `SHIPPED`
- `DELIVERED`

### 관리자 역할 (`admins.role`)

- `SUPER`
- `STAFF`

## 4) 테이블 DDL

### 4.1 categories

```sql
CREATE TABLE categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parent_id BIGINT UNSIGNED NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_categories_parent
        FOREIGN KEY (parent_id) REFERENCES categories(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_categories_parent_slug
        UNIQUE (parent_id, slug)
);
```

### 4.2 products

```sql
CREATE TABLE products (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    short_description VARCHAR(500) NULL,
    description TEXT NULL,
    base_price INT NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    is_sold_out BOOLEAN NOT NULL DEFAULT FALSE,
    consultation_required BOOLEAN NOT NULL DEFAULT TRUE,
    stock_quantity INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

### 4.3 product_images

```sql
CREATE TABLE product_images (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    image_type VARCHAR(30) NOT NULL, -- THUMBNAIL / DETAIL
    image_url VARCHAR(500) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_images_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
);
```

### 4.4 product_options

```sql
CREATE TABLE product_options (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    option_group_name VARCHAR(100) NOT NULL,
    option_value VARCHAR(100) NOT NULL,
    extra_price INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_options_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
);
```

### 4.5 orders

```sql
CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(30) NOT NULL UNIQUE,
  order_status ENUM(
    'PENDING_PAYMENT',
    'PAYMENT_REQUESTED',
    'PAYMENT_CONFIRMED',
    'PREPARING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'EXPIRED'
  ) NOT NULL DEFAULT 'PENDING_PAYMENT',
  total_product_price INT UNSIGNED NOT NULL DEFAULT 0,
  shipping_fee INT UNSIGNED NOT NULL DEFAULT 0,
  final_total_price INT UNSIGNED NOT NULL DEFAULT 0,
  customer_request VARCHAR(500) NULL,
  deposit_deadline_at DATETIME NULL,
  payment_requested_at DATETIME NULL,
  payment_confirmed_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  expired_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 4.6 order_items

```sql
CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  product_option_id BIGINT UNSIGNED NULL,
  product_name_snapshot VARCHAR(150) NOT NULL,
  option_name_snapshot VARCHAR(100) NULL,
  option_value_snapshot VARCHAR(100) NULL,
  unit_price INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  line_total_price INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_order_items_product_option
    FOREIGN KEY (product_option_id) REFERENCES product_options(id)
    ON DELETE SET NULL
);
```

### 4.7 order_contacts

```sql
CREATE TABLE order_contacts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL UNIQUE,
  buyer_name VARCHAR(100) NOT NULL,
  buyer_phone VARCHAR(30) NOT NULL,
  receiver_name VARCHAR(100) NOT NULL,
  receiver_phone VARCHAR(30) NOT NULL,
  zipcode VARCHAR(20) NOT NULL,
  address1 VARCHAR(255) NOT NULL,
  address2 VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_contacts_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
);
```

### 4.8 deposits

```sql
CREATE TABLE deposits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL UNIQUE,
  bank_name VARCHAR(100) NOT NULL,
  account_holder VARCHAR(100) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  expected_amount INT UNSIGNED NOT NULL,
  depositor_name VARCHAR(100) NULL,
  requested_at DATETIME NULL,
  confirmed_at DATETIME NULL,
  deposit_status ENUM('WAITING', 'REQUESTED', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'WAITING',
  admin_memo VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_deposits_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
);
```

### 4.9 shipments

```sql
CREATE TABLE shipments (
  shipment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL UNIQUE,
  courier_name VARCHAR(100) NULL,
  tracking_number VARCHAR(100) NULL,
  shipped_at DATETIME NULL,
  delivered_at DATETIME NULL,
  shipment_status ENUM('READY', 'SHIPPED', 'DELIVERED') NOT NULL DEFAULT 'READY',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shipments_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
);
```

### 4.10 order_status_histories

```sql
CREATE TABLE order_status_histories (
  order_status_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  admin_id BIGINT UNSIGNED NULL,
  previous_status ENUM(
    'PENDING_PAYMENT',
    'PAYMENT_REQUESTED',
    'PAYMENT_CONFIRMED',
    'PREPARING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'EXPIRED'
  ) NULL,
  new_status ENUM(
    'PENDING_PAYMENT',
    'PAYMENT_REQUESTED',
    'PAYMENT_CONFIRMED',
    'PREPARING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'EXPIRED'
  ) NOT NULL,
  change_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_status_histories_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_status_histories_admin
    FOREIGN KEY (admin_id) REFERENCES admins(admin_id)
    ON DELETE SET NULL
);
```

### 4.11 admins

```sql
CREATE TABLE admins (
  admin_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  login_id VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role ENUM('SUPER', 'STAFF') NOT NULL DEFAULT 'STAFF',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 5) 구현 전 검토 TODO

- `shipments.order_id` FK와 `order_status_histories.order_id` FK는 `orders.id` 기준으로 통일되어야 한다.
- `order_status_histories.admin_id` FK는 `admins.admin_id` 기준으로 맞춰야 한다.
- 결제 만료 처리(`EXPIRED`) 배치 정책과 트리거 조건을 별도 문서로 분리한다.
- 소프트 삭제 정책(`products.deleted_at`)을 API/쿼리 레이어에서 강제한다.

## 6) 사용 원칙

- 신규 마이그레이션 작성 시 이 파일을 먼저 확인한다.
- 스키마 변경이 발생하면 Notion과 함께 이 파일도 즉시 동기화한다.
- 구현 중 애매한 항목은 이 문서 하단에 TODO로 누적하고 결정 후 확정한다.
