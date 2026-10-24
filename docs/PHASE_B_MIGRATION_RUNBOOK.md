# Tempo Phase B migration runbook

Status: implemented and verified locally; not applied remotely.

Migration: `supabase/migrations/20261021000000_add_sync_metadata.sql`

## Scope

The migration adds backward-compatible metadata to the four synchronized entities:

- `profiles`: `revision`, `settings_version`, `deleted_at`.
- `lists`: `revision`, `deleted_at`.
- `tasks`: `revision`, `completed_at`, `archived_at`, `deleted_at`.
- `blocks`: `revision`, `deleted_at`.

Server triggers normalize new rows to revision 1 and increment `revision` plus `updated_at` on every update. Existing task behavior remains unchanged: `is_archived` stays authoritative, deletes stay physical, and lifecycle timestamps remain null.

## Read-only impact check

Run this before any future remote approval or deployment and record the result without exporting row contents:

```sql
select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.lists) as lists,
  (select count(*) from public.tasks) as tasks,
  (select count(*) from public.tasks where is_archived) as archived_tasks,
  (select count(*) from public.blocks) as blocks;
```

Phase B does not reclassify archived tasks. The `archived_tasks` count is informational for the later lifecycle preview.

## Local validation

```powershell
npm run db:start
npm run db:reset
npm run db:types:local
npm run verify:foundation
```

Expected result:

- Both migrations apply from an empty local database.
- Generated contracts match the local schema.
- 20 application tests pass.
- 6 Edge Function static checks pass.
- 43 database assertions pass: 23 RLS and 20 metadata checks.

## Remote deployment gate

Remote execution requires a separate explicit approval. Before it:

1. Confirm a restorable database backup or point-in-time recovery window.
2. Record the baseline migration as applied in remote migration history.
3. Compare the read-only impact counts with the latest audit.
4. Review the exact pending migration list.
5. Apply only the Phase B migration.
6. Regenerate remote types, rerun application checks, and repeat the read-only counts.

Do not enable Phase C synchronization or task lifecycle UI as part of this deployment.

## Recovery strategy

- The migration and its validation run transactionally. A failed invariant raises an exception and rolls the migration back.
- If the migration commits but application verification fails, stop the rollout. The current client ignores the additive columns, so no emergency destructive rollback is required.
- Prefer a reviewed forward corrective migration over dropping columns after production data can use them.
- If removal is unavoidable before Phase C activation, first verify that every new lifecycle column is null and every revision is still migration-generated, then prepare a separately reviewed migration that removes the four triggers, the metadata function, constraints, and columns.
- If any unexpected row mutation is detected, restore from the confirmed backup rather than attempting an ad-hoc repair.

No remote command in this runbook is pre-approved.
