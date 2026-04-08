# Agent Rules

## UI Change Validation
- Any task that changes or removes UI must be validated with Playwright browser testing before completion.
- This includes layout/styling/component changes and UI behavior changes.
- For admin web E2E, always authenticate first using admin credentials from `.env` before running page-flow checks.
  - Read `ADMIN_E2E_LOGIN_ID` and `ADMIN_E2E_PASSWORD` from `backend/.env` (or project `.env` if provided).
  - If credentials are missing/invalid, report the blocker explicitly and run available fallback checks.
- If Playwright validation cannot run due to environment issues (server down, auth block, permission limits), report the exact blocker and run available fallback checks (build/lint/tests) before handoff.

## Backend Run Permissions
- When starting backend dev server (`npm --prefix backend run start:dev`), always request escalated sandbox permissions (`sandbox_permissions: require_escalated`).
- Reason: default sandbox/network restrictions can cause DB connection failure (`Prisma P1001`) even when app code is fine.
