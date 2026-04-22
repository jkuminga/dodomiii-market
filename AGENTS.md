# Agent Rules

## Backend Run Permissions
- When starting backend dev server (`npm --prefix backend run start:dev`), always request escalated sandbox permissions (`sandbox_permissions: require_escalated`).
- Reason: default sandbox/network restrictions can cause DB connection failure (`Prisma P1001`) even when app code is fine.

## Database Migrations
- This project's Supabase direct DB host (`DIRECT_URL`, `db.<project-ref>.supabase.co:5432`) is currently not IPv4-compatible in this environment, so `npx prisma migrate deploy` may fail even when the SQL is valid.
- `DATABASE_URL` uses the Supabase session pooler and is reachable from this environment. If a schema change must be applied here, prefer manual SQL execution over the app Prisma connection instead of `prisma migrate deploy`.
- Before assuming a migration file is wrong, compare connectivity:
  - direct host failure such as `No route to host` or `P1001` means a network/direct-access problem
  - pooler host success means app/runtime DB access is still available
- For manual migration application:
  - keep the Prisma migration folder and SQL file in the repo as usual
  - execute the migration SQL manually against the database using the app Prisma connection (`new PrismaClient()` + Prisma raw SQL)
  - verify the new table/index/column exists after execution
- After manual SQL application, also record the migration in `_prisma_migrations` so Prisma's migration history stays aligned with the actual database state.
- Do not stop at "table exists" for manual migrations. The expected completion state is:
  - schema change applied
  - target objects verified
  - `_prisma_migrations` updated to reflect the migration as applied
- Preferred shell pattern for manual SQL is a single-quoted `node -e '...'` script plus Prisma tagged templates (`prisma.$queryRaw\`...\`` / `prisma.$executeRaw\`...\``).
- Prefer Prisma parameter binding over hand-built SQL strings when values are dynamic. This avoids quoting mistakes that repeatedly occurred with raw string interpolation.
- If identifiers must be quoted in SQL, use normal Postgres double quotes inside the tagged template, for example `INSERT INTO "notices" (...)`.
- For JSON payloads, build the JSON string in JS first and cast in SQL only where needed, for example `${content}::jsonb`.
- If the result includes `BigInt` columns (for example `id`), normalize them before `JSON.stringify`, for example `rows.map((row) => ({ ...row, id: row.id.toString() }))`.
- Verified safe dummy SQL pattern in this project:
  - insert with `prisma.$queryRaw\`INSERT ... RETURNING ...\``
  - then delete with `prisma.$queryRaw\`DELETE ... RETURNING ...\``
  - this path was tested successfully against `notices` using a temporary dummy row and immediate cleanup
- After any manual migration, check `_prisma_migrations` explicitly and confirm the new migration row exists with an applied state.
- Do not assume `_prisma_migrations` is clean. This database already has prior rolled-back entries mixed with finished entries, so inspect the current state before deciding whether a migration is "managed" by Prisma.
