# Agent Rules

## UI Change Validation
- Any task that changes or removes UI must be validated with Playwright browser testing before completion.
- This includes layout/styling/component changes and UI behavior changes.
- If Playwright validation cannot run due to environment issues (server down, auth block, permission limits), report the exact blocker and run available fallback checks (build/lint/tests) before handoff.

## Backend Run Permissions
- When starting backend dev server (`npm --prefix backend run start:dev`), always request escalated sandbox permissions (`sandbox_permissions: require_escalated`).
- Reason: default sandbox/network restrictions can cause DB connection failure (`Prisma P1001`) even when app code is fine.
