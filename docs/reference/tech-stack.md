# DODOMIII MARKET - Tech Stack & Engineering Strategy

- 버전: v1.0
- 작성일: 2026-03-27
- 적용 범위: MVP
- 연관 문서:
  - `docs/reference/db-schema.md`
  - `docs/reference/api-endpoints.md`
  - `docs/tracking/implementation-checklist.md`

## 1) 확정 스택

### 1.1 Frontend

- `React + Vite`
- 라우팅: `React Router`
- 서버 상태: `TanStack Query`
- 클라이언트 상태: `Zustand`
- 스타일: `Tailwind CSS`

### 1.2 Backend

- `NestJS`
- ORM: `Prisma`
- Validation: `class-validator`, `class-transformer`
- API 문서(코드 기반): `Swagger (OpenAPI)`

### 1.3 Database

- `Supabase Postgres`
- 마이그레이션: `Prisma Migrate`

### 1.4 API 협업 문서

- `Apidog`를 외부 협업용 명세 채널로 사용
- 저장소 기준 명세는 `docs/reference/api-endpoints.md`를 기준으로 동기화

### 1.5 배포/인프라

- 배포: `Vercel` (Frontend + Backend)
- CI: `GitHub Actions`

### 1.6 모니터링/로깅

- 애플리케이션 로깅: `Pino`
- 에러 트래킹: `Sentry`

## 2) 백엔드 전략

### 2.1 아키텍처

- 구조: `Vercel(React) + Vercel(Nest API) + Supabase(Postgres)`
- 원칙: 프론트/백 분리, DB는 단일 소스(Postgres)

장점:
- MVP에서 빠른 출시 가능
- 인프라 운영 난이도 낮음
- 향후 백엔드 독립 확장에 유리

### 2.2 ORM 전략 (Prisma)

- `schema.prisma`로 스키마 선언
- `prisma migrate`로 변경 이력 관리
- 서비스 레이어에서 타입 안전 쿼리 사용

장점:
- SQL 실수 감소
- 타입 기반 개발 속도/안정성 확보
- 마이그레이션 이력 추적 용이

## 3) 테스트 전략 (초기 운영 친화형)

### 3.1 테스트 계층

1. Unit Test
- 대상: 도메인 서비스, 상태 전이 검증 로직
- 도구: `Jest`

2. Integration Test
- 대상: Controller + Service + DB 연동
- 도구: `Jest + Supertest`

3. E2E 핵심 시나리오
- 범위: `주문 생성 -> 입금요청 -> 상태변경 -> 배송`

### 3.2 테스트 우선순위

- 금전/주문 흐름을 최우선 보호
- 카탈로그 조회 등 저위험 기능은 최소 커버

장점:
- 품질 대비 비용 균형이 좋음
- 초반 과도한 테스트 작성 부담 방지
- 장애 빈도가 높은 핵심 플로우 선제 보호

## 4) 배포 전략

### 4.1 파이프라인

1. Pull Request 생성
2. GitHub Actions에서 lint/test 실행
3. 통과 시 Vercel Preview 배포
4. `main` 머지 시 Production 자동 배포

### 4.2 운영 규칙

- 배포 전 필수: 테스트 통과 + API 명세 동기화
- 장애 대응: hotfix 브랜치 후 패치 배포

장점:
- 사람 의존 배포 실수 감소
- PR 단계에서 실제 URL 검증 가능

## 5) Git 브랜치/버전관리 전략

### 5.1 브랜치 모델 (Trunk-based)

- 기본 브랜치: `main` (항상 배포 가능 상태 유지)
- 작업 브랜치:
  - `feat/*`
  - `fix/*`
  - `chore/*`
  - `docs/*`
  - (필요 시) `hotfix/*`, `release/*`

### 5.2 PR 규칙

- 1 PR = 1 기능/수정 단위
- PR 크기는 작게 유지(1~2일 내 머지 가능한 크기)
- 머지 조건:
  - CI 통과
  - 리뷰 반영
  - 관련 문서 동기화

### 5.3 커밋 메시지 (Conventional Commits)

- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `test: ...`
- `docs: ...`
- `chore: ...`

예시:
- `feat(order): create order API`
- `fix(payment): validate deposit amount`

### 5.4 버전 정책 (SemVer)

- 형식: `MAJOR.MINOR.PATCH`
- MVP 초기 버전: `0.1.0`
- 기능 추가: `0.x.0` 증가
- 버그 수정: `0.x.y` 증가
- 운영 배포 시 Git Tag: `v0.1.0` 형태

## 6) DB/마이그레이션 운영 원칙

- 스키마 변경은 반드시 마이그레이션 파일과 함께 커밋
- `코드 변경 + 마이그레이션`은 같은 PR에서 처리
- 롤백 위험이 있는 변경은 PR 설명에 명시
- DB 기준 문서는 `docs/reference/db-schema.md`와 동기화

## 7) 문서 동기화 원칙

아래 3개는 항상 함께 맞춘다.

1. 구현 코드
2. `docs/reference/api-endpoints.md`
3. `Apidog` 프로젝트 명세

## 8) 현재 결정 요약

- Front: React + Vite
- Back: NestJS + Prisma
- DB: Supabase Postgres
- Deploy: Vercel
- API 협업: Apidog
- Test: Jest + Supertest + 핵심 E2E
- 운영: Pino + Sentry
- Git: Trunk-based + Conventional Commits + SemVer
