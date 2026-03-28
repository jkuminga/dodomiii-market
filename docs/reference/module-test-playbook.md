# DODOMIII MARKET - 모듈 테스트 플레이북

이 문서는 매 모듈 작업 후, 프론트/백을 함께 검증하기 위한 공통 가이드다.

## 1) 공통 실행

1. 루트에서 개발서버 실행
- `npm run dev`

2. 접속 링크
- Frontend: `http://localhost:5173`
- Backend Health: `http://localhost:4000/api/v1/health`

3. 모듈 완료 후 최소 검증
- `npm run check`

## 2) 모듈별 수동 테스트 항목

### M03/F03 관리자 인증

테스트 순서:
1. `http://localhost:5173/admin/login` 접속
2. 잘못된 계정/비밀번호로 로그인 시 에러 노출 확인
3. 정상 계정으로 로그인
4. `/admin` 화면에서 관리자 정보 표시 확인
5. 로그아웃 버튼 클릭 후 `/admin/login`으로 복귀 확인

백엔드 확인 포인트:
- `POST /api/v1/admin/auth/login` 200/401
- `GET /api/v1/admin/auth/me` 세션 없으면 401
- `POST /api/v1/admin/auth/logout` 200

### M04/F04 스토어 카탈로그

테스트 순서:
1. 홈 -> 카테고리/상품목록 진입
2. 카테고리 필터 적용 확인
3. 검색어 입력 후 목록 필터링 확인
4. 상품 클릭 -> 상세 진입
5. 숨김/삭제 상품 노출되지 않는지 확인

백엔드 확인 포인트:
- `GET /api/v1/store/categories`
- `GET /api/v1/store/products`
- `GET /api/v1/store/products/{productId}`

### M05~M06/F05 주문 흐름

테스트 순서:
1. 상품 옵션 선택 후 주문 생성
2. 주문번호 수령 확인
3. 주문번호 조회 화면에서 주문 상태 확인
4. 입금 확인 요청 후 상태 반영 확인

백엔드 확인 포인트:
- `POST /api/v1/store/orders`
- `GET /api/v1/store/orders/{orderNumber}`
- `POST /api/v1/store/orders/{orderNumber}/deposit-requests`
- `GET /api/v1/store/orders/{orderNumber}/tracking`

## 3) 체크리스트 기록 규칙

각 모듈 완료 시 `docs/tracking/implementation-checklist.md`의 해당 모듈 비고에 아래 형식으로 기록:

- `검증: backend build OK, frontend build OK, 수동테스트 OK(YYYY-MM-DD)`
- 실패 시:
  - `검증: 수동테스트 FAIL (경로/증상)`
  - `조치: ...`
