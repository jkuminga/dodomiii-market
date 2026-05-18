# Admin Product Blog Editor Design

## Goal

관리자 상품 생성/수정 화면의 상품 상세 작성 경험을 네이버 블로그 스마트에디터 ONE과 비슷한 문서형 편집 방식으로 바꾼다.

현재 상품 에디터는 `description` 텍스트와 `product_images` 목록을 따로 관리한다. 목표 화면은 관리자가 상품 상세 본문 안에 이미지를 드래그해 넣고, 글을 쓰고, 이미지/텍스트 블록 순서를 조정하면서 상품 상세 페이지를 구성하는 방식이다.

## Current State

### Frontend

- 상품 편집 화면: `frontend/src/pages/admin/AdminProductEditorPage.tsx`
- 현재 `ProductFormState.description`은 단순 문자열이다.
- 현재 이미지는 `ProductImageDraft[]`로 별도 관리한다.
  - `THUMBNAIL`: 상품 목록/대표 이미지
  - `DETAIL`: 상세 탭에서 이미지 목록으로 노출
- 이미지는 Cloudinary signed upload 흐름을 이미 사용한다.
  - `apiClient.signAdminUpload`
  - Cloudinary direct upload
  - `apiClient.finalizeAdminUpload`
- 공지사항 편집 화면에는 이미 간단한 블록형 본문이 있다.
  - `frontend/src/pages/admin/AdminNoticeEditorPage.tsx`
  - `text` / `image` 블록
  - `contentJson.version`, `contentJson.blocks`

### Backend

- 상품 DB 모델: `backend/prisma/schema.prisma`
  - `products.description String?`
  - `product_images(image_type, image_url, sort_order)`
- 상품 DTO:
  - `backend/src/modules/admin/dto/create-admin-product.dto.ts`
  - `backend/src/modules/admin/dto/update-admin-product.dto.ts`
- 상품 저장 로직:
  - `backend/src/modules/admin/admin.service.ts`
  - `createProduct`, `updateProduct`
- 상품 상세 조회:
  - 관리자: `AdminProductDetailResponse`
  - 스토어: `ProductDetail`
- 공지사항에는 이미 JSON 본문 패턴이 있다.
  - `AdminNoticeContentDto`
  - `normalizeNoticeContent`
  - `notices.content_json`

## Design Direction

상품 상세 본문은 HTML 문자열이 아니라 블록 JSON으로 저장한다.

이유:

- 이미지/텍스트/구분선/인용구를 안정적으로 재정렬할 수 있다.
- 드래그 앤 드롭 편집 상태와 저장 상태가 일치한다.
- 캡션, 링크, 대표 이미지, 정렬, 너비 같은 속성을 블록별로 보존할 수 있다.
- 나중에 모바일 편집, 템플릿, 미리보기, 상세 이미지 그룹을 확장하기 쉽다.
- 공지사항 `contentJson.blocks` 패턴과 맞아 백엔드/프론트 구현 리스크가 낮다.

기존 `product_images`는 즉시 제거하지 않는다.

- `THUMBNAIL`은 상품 목록/대표 이미지로 계속 필요하다.
- 기존 `DETAIL` 이미지는 마이그레이션 기간 동안 fallback으로 유지한다.
- 새 상세 본문은 `products.content_json` 같은 JSON 컬럼으로 추가한다.

## Product Content Schema

초기 버전은 `version: 1`로 시작한다.

```ts
export type ProductContent = {
  version: 1;
  blocks: ProductContentBlock[];
};

export type ProductContentBlock =
  | ProductParagraphBlock
  | ProductHeadingBlock
  | ProductImageBlock
  | ProductImageGroupBlock
  | ProductQuoteBlock
  | ProductDividerBlock;

export type ProductParagraphBlock = {
  id: string;
  type: 'paragraph';
  text: string;
};

export type ProductHeadingBlock = {
  id: string;
  type: 'heading';
  level: 2 | 3;
  text: string;
};

export type ProductImageBlock = {
  id: string;
  type: 'image';
  imageUrl: string;
  publicId: string | null;
  alt: string | null;
  caption: string | null;
  linkUrl: string | null;
  align: 'left' | 'center' | 'right';
  widthMode: 'small' | 'content' | 'wide';
  width: number | null;
  height: number | null;
  isCover: boolean;
};

export type ProductImageGroupBlock = {
  id: string;
  type: 'imageGroup';
  layout: 'grid' | 'collage' | 'slider';
  images: Array<{
    imageUrl: string;
    publicId: string | null;
    alt: string | null;
    caption: string | null;
    width: number | null;
    height: number | null;
  }>;
};

export type ProductQuoteBlock = {
  id: string;
  type: 'quote';
  text: string;
};

export type ProductDividerBlock = {
  id: string;
  type: 'divider';
};
```

초기 구현 범위는 `paragraph`, `image`, `divider`, `quote`만 넣어도 된다. `heading`, `imageGroup`은 schema에는 열어두되 UI는 2차로 구현해도 된다.

## Database Plan

Prisma 모델에 JSON 컬럼을 추가한다.

```prisma
model Product {
  ...
  description String?
  contentJson Json? @map("content_json")
  ...
}
```

마이그레이션 SQL:

```sql
ALTER TABLE "products"
ADD COLUMN "content_json" JSONB;
```

이 프로젝트의 Supabase direct DB host는 현재 환경에서 IPv4 접근 이슈가 있으므로, 실제 적용 시 `AGENTS.md` 지침에 따라 Prisma migrate deploy 실패 여부를 네트워크 문제와 구분한다. 필요하면 Prisma app connection을 통한 수동 SQL 적용 후 `_prisma_migrations` 기록까지 완료한다.

## API Contract

### Create/Update Product Payload

기존 payload에 `contentJson`을 추가한다.

```ts
export type AdminProductPayload = {
  categoryId: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  contentJson: ProductContent | null;
  basePrice: number;
  discountRate: number;
  isVisible: boolean;
  isSoldOut: boolean;
  consultationRequired: boolean;
  images: AdminProductImageInput[];
  optionGroups: AdminProductOptionGroupInput[];
};
```

호환 정책:

- 새 에디터는 `contentJson`을 저장한다.
- `description`은 당분간 짧은 plain-text fallback으로 유지한다.
- 스토어 상세 조회는 `contentJson`이 있으면 블록 렌더링을 사용한다.
- `contentJson`이 없으면 기존 `description` + `DETAIL` 이미지 렌더링을 유지한다.

### Validation

백엔드 DTO를 새로 둔다.

- `AdminProductContentDto`
- `AdminProductContentBlockDto`
- image block은 `imageUrl` 필수
- text 계열 block은 빈 문자열 저장 금지
- `imageUrl`, `publicId`, `caption`, `alt`, `linkUrl` 길이 제한
- blocks 개수 제한: 초기 100개
- 이미지 그룹 내 이미지 개수 제한: 초기 10개

## Admin UI Plan

상품 편집 화면을 다음 영역으로 나눈다.

1. 기본 정보
   - 카테고리
   - 상품명
   - slug
   - 가격/할인율
   - 노출/품절/상담 필요

2. 대표 이미지
   - 기존 `THUMBNAIL` 관리 유지
   - 상품 목록, 홈, 카탈로그용 이미지
   - 블로그 본문 이미지와 분리

3. 상세 본문 에디터
   - 공지사항처럼 블록 데이터 구조를 사용하되, UI는 공지사항의 카드 리스트가 아니라 네이버 블로그처럼 하나의 글쓰기 캔버스로 만든다.
   - 관리자에게는 여러 개의 독립 카드가 아니라 하나의 큰 입력 폼처럼 보인다.
   - 텍스트 블록, 이미지 블록, 구분선, 인용구가 같은 본문 흐름 안에 이어진다.
   - 빈 줄 왼쪽의 `+` 버튼 또는 상단 툴바로 현재 커서 위치에 블록을 삽입한다.
   - 이미지 파일을 본문 영역에 드롭하면 드롭한 위치에 image block을 생성한다.
   - 텍스트는 캔버스 안에서 바로 입력한다. 첫 구현은 textarea/contenteditable 중 구현 리스크가 낮은 방식으로 시작하고, 저장 구조는 동일하게 유지한다.
   - 블록 경계는 편집 중에만 은은하게 표시하고, 기본 상태는 하나의 문서처럼 보이게 한다.
   - 블록 이동은 드래그 핸들 또는 키보드 보조 버튼으로 제공한다.
   - 이미지 선택 시 작은 floating toolbar 또는 우측 속성 패널을 표시한다.
     - 너비: 작게 / 본문 너비 / 넓게
     - 정렬: 왼쪽 / 가운데 / 오른쪽
     - 캡션
     - alt
     - 링크
     - 대표 상세 이미지 표시

4. 옵션
   - 현재 옵션 편집 유지
   - 상품 설명 에디터와 별도 섹션

5. 미리보기
   - 우측 sticky preview 또는 별도 탭
   - 실제 상품 상세 렌더러와 같은 컴포넌트를 사용

## Editor Interaction Model

상품 상세 본문 에디터는 내부적으로는 block array지만, 사용자에게는 하나의 문서 입력 영역처럼 보여야 한다.

### Visual Structure

```txt
┌──────────────────────────────────────────────┐
│ 상세 본문                                    │
│ ┌──────────────────────────────────────────┐ │
│ │ 제목 없이 바로 글쓰기 시작...            │ │
│ │                                          │ │
│ │ +  문단 텍스트 입력 영역                 │ │
│ │                                          │ │
│ │    [업로드된 이미지]                     │ │
│ │    캡션 입력...                          │ │
│ │                                          │ │
│ │ +  다음 문단 입력 영역                   │ │
│ │                                          │ │
│ │    ─────────────────────────             │ │
│ │                                          │ │
│ │ +  계속 작성                             │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

카드형 UI와 다르게 다음 원칙을 지킨다.

- 각 블록을 두꺼운 카드 테두리로 감싸지 않는다.
- 블록 사이 여백은 실제 상품 상세 페이지의 문단 간격과 비슷하게 둔다.
- hover/focus 상태에서만 왼쪽에 `+`, drag handle, 삭제 같은 편집 컨트롤을 노출한다.
- 이미지 블록은 본문 안에 자연스럽게 놓이고, 클릭했을 때만 크기/정렬/링크 툴바가 뜬다.
- 빈 상태는 큰 drop zone으로 보이되, 작성이 시작되면 일반 문서처럼 보이게 한다.

### Insert Behavior

- 캔버스 마지막 빈 줄에서 Enter를 누르면 새 paragraph block을 만든다.
- 블록 왼쪽 `+`를 누르면 해당 위치에 삽입 메뉴를 연다.
- 삽입 메뉴 항목:
  - 텍스트
  - 이미지
  - 구분선
  - 인용구
- 이미지 파일을 특정 문단 사이에 드롭하면 그 위치에 image block을 삽입한다.
- 여러 이미지를 한 번에 드롭하면 초기에는 이미지 블록을 여러 개 연속 생성한다.
- 2차 구현에서 여러 이미지 선택 시 `imageGroup`으로 묶는 옵션을 추가한다.

### Move Behavior

- 첫 구현은 공지사항처럼 위/아래 이동 버튼을 제공하되, 버튼은 hover 시에만 보이게 한다.
- 다음 단계에서 drag handle로 블록을 직접 끌어 이동하게 한다.
- 이동 후 `blocks` 배열 순서가 곧 저장 순서가 된다.

### Editing Behavior

- 텍스트 블록은 본문에 직접 입력하는 느낌을 우선한다.
- 저장 전 빈 텍스트 블록은 자동 제거하거나 사용자에게 정리 메시지를 보여준다.
- 이미지 블록은 업로드 중 skeleton/progress 상태를 본문 위치에 그대로 표시한다.
- 이미지 업로드 실패 시 해당 위치에 재시도 UI를 표시한다.

## Frontend Component Split

`AdminProductEditorPage.tsx`가 이미 큰 파일이므로 블로그형 에디터를 별도 컴포넌트로 분리한다.

추천 파일:

```txt
frontend/src/pages/admin/product-editor/productContentTypes.ts
frontend/src/pages/admin/product-editor/ProductContentEditor.tsx
frontend/src/pages/admin/product-editor/ProductContentCanvas.tsx
frontend/src/pages/admin/product-editor/ProductContentBlock.tsx
frontend/src/pages/admin/product-editor/ProductImageBlockEditor.tsx
frontend/src/pages/admin/product-editor/ProductContentInsertMenu.tsx
frontend/src/pages/admin/product-editor/ProductContentToolbar.tsx
frontend/src/pages/admin/product-editor/ProductContentPreview.tsx
frontend/src/pages/admin/product-editor/productContentSerialization.ts
```

상품 상세 사용자 화면 렌더러는 관리자 미리보기와 공유한다.

```txt
frontend/src/components/store/ProductContentRenderer.tsx
```

## Image Upload Flow

본문 이미지 업로드는 기존 Cloudinary 흐름을 재사용한다.

1. 관리자가 파일을 본문에 드롭하거나 이미지 블록에서 파일 선택
2. 프론트가 임시 image block 생성
3. `usage: PRODUCT_DETAIL`로 signed upload 요청
4. Cloudinary에 직접 업로드
5. `admin/media/finalize` 호출
6. block에 `imageUrl`, `publicId`, `width`, `height` 저장
7. 기존 이미지 교체 시 이전 `publicId`는 비동기로 delete 요청

주의:

- 현재 `PRODUCT_DETAIL` 최대 용량은 10MB다.
- 네이버 블로그 조사값은 장당 20MB였지만, 이 프로젝트 정책은 Cloudinary 비용과 화면 성능을 고려해 우선 10MB 유지가 적절하다.
- 필요하면 `AdminMediaService.usagePolicy.PRODUCT_DETAIL.maxBytes`만 별도 조정한다.

## Storefront Rendering

`frontend/src/pages/store/ProductDetailPage.tsx`의 상세 탭은 다음 순서로 렌더링한다.

1. `product.contentJson?.blocks.length > 0`
   - `ProductContentRenderer`로 렌더링
2. 없으면 기존 상세 이미지 목록 렌더링
3. 그것도 없으면 `description` fallback 표시

정책 탭의 `product.description` 사용은 새 본문과 분리한다. 정책 탭은 배송/환불 안내 중심으로 유지하고, 상품 소개성 본문은 상세 탭으로 옮긴다.

## Migration Strategy

1. DB에 `products.content_json` 추가
2. 백엔드 DTO/응답에 `contentJson` 추가
3. 기존 상품은 `contentJson = null` 상태로 둔다
4. 스토어 렌더러는 기존 `DETAIL` 이미지 fallback 지원
5. 관리자가 기존 상품을 수정할 때 선택적으로 기존 `description`과 `DETAIL` 이미지를 content blocks로 변환하는 버튼 제공
   - `description`이 있으면 paragraph block 생성
   - `DETAIL` 이미지는 image block으로 변환
   - 변환 후에도 기존 `product_images`는 바로 삭제하지 않는다

## Implementation Phases

### Phase 1: Data Contract

- Prisma `Product.contentJson` 추가
- migration 추가
- `AdminProductContentDto` 추가
- create/update/get admin product에 `contentJson` 연결
- store product detail 응답에 `contentJson` 추가
- API 타입 업데이트

### Phase 2: Renderer

- `ProductContentRenderer` 구현
- 상품 상세 상세 탭에 renderer 적용
- `contentJson` 없을 때 기존 UI fallback 유지

### Phase 3: Admin Editor MVP

- `ProductContentEditor` 구현
- paragraph/image/divider/quote 추가
- 이미지 업로드 및 교체
- 하나의 글쓰기 캔버스 안에서 블록이 이어져 보이도록 구현
- 위/아래 이동 버튼으로 순서 변경
- 저장 payload에 `contentJson` 포함

### Phase 4: Blog-like Drag UX

- 본문 영역 파일 drag/drop으로 image block 생성
- 블록 카드 drag/drop 재정렬
- 블록 카드처럼 보이지 않도록 캔버스형 시각 표현 적용
- 이미지 블록 선택 시 floating toolbar 또는 속성 패널
- 본문 미리보기 강화

### Phase 5: Migration Helpers

- 기존 `description` + `DETAIL` 이미지를 blocks로 변환하는 관리자 버튼
- 저장 전 변환 미리보기
- 기존 상세 이미지 입력 UI는 점진적으로 접거나 고급 설정으로 이동

## Decisions

- `product_images.THUMBNAIL`은 유지한다.
- 상세 본문은 `products.content_json`에 JSONB로 저장한다.
- 기존 `description`은 당분간 fallback/plain summary 역할로 유지한다.
- 첫 구현은 공지사항 블록 에디터 패턴을 확장한다.
- HTML raw 저장은 사용하지 않는다.

## Open Questions

- 상세 본문 이미지도 상품 대표 이미지 후보로 쓸 것인가?
  - 권장: 초기에는 아니오. 대표 이미지는 `THUMBNAIL`에서만 관리한다.
- 본문 텍스트를 rich text로 시작할 것인가?
  - 권장: 초기에는 plain textarea. 굵게/링크/색상은 2차.
- 상세 이미지 그룹/콜라주를 첫 버전에 넣을 것인가?
  - 권장: 2차. 단일 이미지와 텍스트 드래그 경험을 먼저 완성한다.
- 기존 `DETAIL` 이미지 UI를 언제 제거할 것인가?
  - 권장: 새 renderer와 변환 버튼 안정화 후 제거한다.
