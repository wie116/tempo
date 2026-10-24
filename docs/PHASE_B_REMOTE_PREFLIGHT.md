# Tempo Phase B remote preflight

Checked: 2026-10-21
Mode: read-only
Remote writes performed: none

## Result

The managed-backup listing is empty and Point-in-Time Recovery is disabled. A separately approved manual logical backup has now satisfied the recovery gate for the planned Phase B rollout.

## Current remote impact counts

| Entity | Rows |
|---|---:|
| Profiles | 7 |
| Lists | 39 |
| Tasks | 92 |
| Archived tasks under the legacy flag | 20 |
| Blocks | 2,840 |
| Calendar connections | 0 |
| Daily activity rows | 57 |

Database size reported by PostgreSQL: 14 MB.

The `tasks.revision` column is absent, confirming that Phase B has not been applied remotely.

## Migration history

- Local migration `20261020000000`: pending remotely.
- Local migration `20261021000000`: pending remotely.
- Remote migration history currently contains neither version.

The baseline must be registered as already applied before Phase B can be pushed. Replaying the baseline against the initialized remote schema is prohibited by its guard.

## Recovery readiness

- Physical-backup infrastructure flag: enabled.
- Point-in-Time Recovery: disabled.
- Available backups returned by the Management API: none.

This initially failed the recovery gate defined in the Phase B runbook.

## Verified manual backup

- Location: `D:\4. App Desarrollo\APP - Time Blocking\tempo-backups\pre-phase-b-20261021-122911`
- Contents: `roles.sql`, `schema.sql`, `data.sql`, and `MANIFEST.txt`.
- Access control: inherited permissions removed; access granted to the current Windows account.
- Integrity: SHA-256 hashes recorded in `MANIFEST.txt` and rechecked.
- Restore test: schema and data restored transactionally into a disposable local Supabase PostgreSQL database.
- Restored counts matched the remote preflight exactly.
- Referential check: zero orphan profiles, tasks, or blocks.
- Cleanup: the disposable database and temporary container copies were removed after verification.
- Result: recovery gate `PASS`.

## Recommended next action

Request a separate approval to register baseline migration `20261020000000` as already applied in the remote migration history. This must not execute its SQL. Verify the remote migration list immediately afterward, then request another separate approval before applying Phase B migration `20261021000000`.

Creating the backup file, repairing migration history, and applying Phase B remain separate actions. The preflight and backup are complete; no remote writes have been performed.
