# Agent Rules

## Backend Run Permissions
- When starting backend dev server (`npm --prefix backend run start:dev`), always request escalated sandbox permissions (`sandbox_permissions: require_escalated`).
- Reason: default sandbox/network restrictions can cause DB connection failure (`Prisma P1001`) even when app code is fine.
