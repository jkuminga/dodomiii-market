# Dodomiii Market Project Overview

이 문서는 `dodomiii-market` 온라인 쇼핑몰 프로젝트의 전반적인 구조와 기술 스택, 핵심 도메인 모델을 요약한 문서입니다. GEMINI 또는 다른 개발자가 프로젝트를 한눈에 파악하기 위해 작성되었습니다.

## 1. 프로젝트 개요
- **프로젝트 명**: dodomiii-market-workspace
- **프로젝트 성격**: 온라인 쇼핑몰 (상품 전시, 주문, 관리자 기능, 무통장 입금 기반 결제 등)
- **구조**: 하이브리드 모노레포 구조 (`frontend`와 `backend`가 분리되어 존재하나 루트 `package.json`에서 스크립트로 통합 관리)

## 2. 기술 스택 (Tech Stack)

### 🧑‍💻 Frontend (사용자 웹 / 관리자 페이지)
- **Core**: React 19, TypeScript, Vite
- **State Management**: Zustand (전역 상태), `@tanstack/react-query` (서버 데이터 페칭 및 캐싱)
- **Routing**: React Router (`react-router-dom` v7)
- **UI/Animation**: `lottie-react` (애니메이션)

### ⚙️ Backend (API 서버)
- **Core**: NestJS 11 (Express 기반), Node.js, TypeScript
- **Database / ORM**: PostgreSQL, Prisma v6
- **Auth & Crypto**: Bcript (`bcryptjs`), Express Session
- **Logging**: `pino-http`
- **External Services**: `nodemailer` (이메일 전송), `solapi` (알림톡/문자 발송 추정)

## 3. 핵심 아키텍처 및 폴더 구조

```text
dodomiii-market/
├── frontend/           # React + Vite 프론트엔드 애플리케이션
│   ├── src/            # 리액트 소스코드 (컴포넌트, 페이지 등)
│   ├── public/         # 정적 자산
│   └── package.json    # 프론트엔드 의존성
├── backend/            # NestJS 백엔드 애플리케이션
│   ├── src/            # 비즈니스 로직, 컨트롤러, 모듈
│   ├── prisma/         # Prisma 스키마 (schema.prisma) 및 마이그레이션 파일
│   └── package.json    # 백엔드 의존성
├── scripts/            # 개발 편의를 위한 쉘 스크립트 모음
├── docs/               # 추가 프로젝트 문서
└── package.json        # 루트 실행 스크립트 (dev, check 등)
```

## 4. 핵심 데이터베이스 모델 (Prisma Schema 요약)

온라인 쇼핑몰의 필수 요소들은 물론, '개인 결제창(Custom Order Link)'이나 '무통장 입금 관리(Deposit)'와 같은 특화된 기능이 설계되어 있습니다.

- **상품 및 카테고리 (Category, Product, ProductImage, ProductOption)**
  - 다이내믹한 카테고리 계층 구조 (자기 참조).
  - 상품 노출 여부(`isVisible`), 품절 여부(`isSoldOut`), 재고(`stockQuantity`) 등 관리.
- **주문 관리 (Order, OrderItem, OrderContact, OrderStatusHistory)**
  - 주문 상태(`OrderStatus`): 결제대기, 결제요청, 결제승인, 상품준비중, 배송중, 배송완료, 취소, 만료 등.
  - 주문 상품 명/옵션/계산 금액 등을 스냅샷 형태로 저장.
- **결제 및 배송 (Deposit, Shipment)**
  - `Deposit`: 무통장 입금 처리를 지원하기 위한 독립 모델 (은행명, 예금주, 계좌번호, 입금자명, 승인 상태 관리).
  - `Shipment`: 택배사 및 운송장 번호 트래킹.
- **관리자 기능 (Admin, HomePopup, CustomOrderLink)**
  - `Admin`: SUPER, STAFF 역할 부여. 관리자별 입금 계좌를 설정할 수 있는 것이 특징적입니다.
  - `HomePopup`: 메인 화면의 팝업 이미지 및 링크 관리 데이터.
  - `CustomOrderLink`: 1:1 커스텀 주문을 위한 보안 결제 링크 토큰을 생성하고, 사용 여부 및 기한 제어 기능 포함 역할.

## 5. 실행 및 개발 가이드
루트 디렉토리에서 아래 명령어로 프로젝트를 실행할 수 있습니다.
- `npm run dev`: 프론트엔드와 백엔드를 동시에 띄우는 스크립트 실행 (`./scripts/dev.sh`)
- `npm run dev:frontend`: 프론트엔드만 실행 (포트 5173)
- `npm run dev:backend`: 백엔드만 실행 (NestJS 환경)
> 백엔드 서버를 띄울 때는 데이터베이스(PostgreSQL)의 구동 및 Prisma 설정(`DATABASE_URL`, `DIRECT_URL`)이 `.env` 파일에 정상 세팅되어 있는지 확인해야 합니다.
