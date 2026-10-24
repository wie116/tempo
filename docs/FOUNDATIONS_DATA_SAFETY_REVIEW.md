# Tempo — Foundations and data safety architecture review

Status: `PREVIEW`
Prepared: 2026-10-20
Scope: architecture proposal only. No application behavior, Supabase schema, credentials, or user data were changed.

## Objective

Establish a safe foundation for future task lifecycle, planning views, habits, integrations, and collaboration without weakening Tempo's local-first behavior or risking existing user data.

## Current implementation findings

### Database workflow

- `supabase/schema.sql` mixes the current schema, compatibility alterations, data backfills, policies, functions, and publication setup in one manually executed file.
- There is no `supabase/migrations/` history that can reproduce the schema in order.
- There is no repository-level record proving which schema changes have been applied to a given environment.
- Rollback currently depends on manual intervention rather than a prepared recovery procedure.

### Database contract

- `src/lib/sync.ts` maps database rows through `any`.
- No generated Supabase `Database` type is checked into the repository.
- A schema drift can therefore compile successfully and fail only at runtime.

### RLS and ownership

- RLS is enabled for the observed public tables.
- `profiles`, `lists`, `tasks`, and `blocks` use direct per-user ownership policies.
- Calendar credential/state tables intentionally expose no client policies and are accessed by Edge Functions using server credentials.
- The repository has no automated test proving that one authenticated user cannot read or mutate another user's rows.

### Settings evolution

- Local Zustand data has a persistence version (`tempo-v3`, version 7) and a local migration function.
- Cloud settings are a flat JSON object in `profiles.settings` without a schema version.
- A client with an older or newer settings shape can overwrite the entire JSON object.

### Synchronization and offline safety

- The initial synchronization downloads all rows from `lists`, `tasks`, and `blocks`.
- Realtime changes schedule another full download.
- The last synchronized snapshot exists only in memory and is lost on reload.
- Offline changes do not have a durable operation queue. A reload before reconnect can make the next full pull overwrite local-only changes.
- Rows are upserted without optimistic concurrency. Concurrent edits to the same row use effective last-write-wins behavior.
- `updated_at` has a default but no general update trigger, and ordinary client upserts do not send a new value. It is therefore not yet a reliable incremental-sync cursor.
- Deletions are physical and are synchronized by comparing missing IDs. They cannot be recovered and offline deletions can be resurrected by a later full pull.

### Task lifecycle

- `Task.archived` / `tasks.is_archived` represents both completion and manual archive.
- Completing a block for a non-recurring task archives the task automatically.
- Removing a task deletes its linked blocks locally, followed by physical deletion in Supabase.
- There is no distinct completed view, archive state, trash state, restore action, or deletion tombstone.

### Time and timezone semantics

- Tempo blocks intentionally store local wall-clock text such as `2026-08-09T09:30`.
- Most schedule calculations use the browser/device timezone, not the configured `settings.timeZone`.
- The Google Calendar importer currently slices the source ISO timestamp to 16 characters. That retains the source wall-clock text but discards its offset as a first-class value.
- Recurrence expansion is calendar-based and should remain calendar-based, but it needs one explicit planning timezone for travel and daylight-saving transitions.

## Recommended decisions

### 1. Versioned, forward-only migrations

Create `supabase/migrations/` and treat each reviewed change as an ordered migration. Keep `schema.sql` only as a generated/readable snapshot after the baseline is established.

Recommended operating rules:

- Record a baseline matching the live project before applying new DDL.
- Never replay the baseline destructively against the existing project.
- Apply structural and data backfill changes in separately reviewable migrations when practical.
- Prefer forward fixes over generic down migrations once production data may have changed.
- Before a risky migration, produce a database backup plus a tested recovery script or restore procedure.
- Run migrations first in a local or isolated validation environment, then staging if available, then production.

### 2. Generated Supabase types as the contract

Generate and commit `src/lib/database.types.ts`, instantiate `createClient<Database>()`, and replace row-level `any` in synchronization and Edge Function boundaries.

Acceptance rule: a migration is incomplete until types are regenerated and the application compiles against them. CI should fail when generated types differ from the committed contract.

### 3. Automated RLS and ownership tests

Add a reproducible test suite with two authenticated identities and an anonymous client.

Minimum matrix:

- Owner can select, insert, update, and delete their own profile/list/task/block rows.
- User A cannot read or mutate User B's rows, even when IDs are known.
- Anonymous access is denied.
- Calendar credential, OAuth state, and sync-state tables are inaccessible to normal clients.
- Service-only functions and administrative aggregates remain unavailable to authenticated clients.
- Activity recording accepts only the current user and server-approved date.

### 4. Explicit settings schema version

Add `profiles.settings_version` and keep `settings` readable during a compatibility window. Use pure, sequential normalization functions on the client.

Safety behavior:

- Older versions are upgraded locally before use.
- Missing fields receive defaults.
- Unknown fields are preserved when possible.
- If the server contains a newer unsupported version, the older client must not overwrite it; it should enter a safe read-only settings state and ask for an app update.
- Settings writes use revision checking rather than replacing a concurrently modified blob silently.

### 5. Incremental synchronization with durable recovery

Replace in-memory snapshot comparison with a durable outbox and server revisions.

Recommended model:

- Every synchronized row receives server-maintained `updated_at`, an integer `revision`, and nullable `deleted_at`.
- Local changes are written to local state and a persistent outbox before being considered complete.
- Each outbox item records entity, row ID, operation, patch, base revision, and creation time.
- Reconnect order is: open local state immediately, upload pending operations, resolve conflicts, then pull server deltas.
- Pulls are table-specific and incremental, ordered by `(updated_at, id)` with a stored cursor.
- Realtime becomes a hint to request deltas, not a reason to download every table.
- Deletes first create a tombstone. Physical purge is a separate explicit operation after every active client has had a chance to observe it.
- A revision mismatch never silently discards a local edit. Preserve the local version in a recovery/conflict record until the user resolves it.

The first implementation can use row-level conflict detection. Field-level automatic merge should only be added later where it is demonstrably safe.

### 6. Separate task lifecycle states

Model completion, archive, trash, and permanent deletion independently.

Recommended fields:

- `completed_at timestamptz null`
- `archived_at timestamptz null`
- `deleted_at timestamptz null`

Effective presentation precedence: trash, archived, completed, active. Block `status` remains separate because it records what happened to an individual scheduled occurrence.

Migration strategy for existing `is_archived` rows:

- If a non-recurring task has a linked completed block, initialize `completed_at` from the best available completion evidence.
- If it is archived without a completed block, initialize `archived_at` from `updated_at` as an approximation.
- Produce a read-only count of each migration category before applying it.
- Keep `is_archived` during a compatibility release and remove it only after verification.
- Do not enable automatic trash purging initially. Permanent deletion remains an explicit, separately confirmed operation.

The task lifecycle UI, trash, and restore behavior still require their own visual preview before implementation.

### 7. Fixed planning timezone with explicit external instants

Use the selected IANA timezone as Tempo's planning timezone. A 09:30 Tempo block remains a 09:30 planning block; traveling or changing the device timezone does not silently move it.

Recommended storage policy:

- Keep Tempo-owned block wall-clock values as local date/time plus planning timezone context.
- Recurrence rules expand on calendar dates in that planning timezone.
- Timers, “today”, automatic planning, and reminders calculate now in the planning timezone rather than the device timezone.
- External calendar events also retain their original instant/offset and source timezone. Their projected Tempo wall-clock value is derived, not the only stored representation.
- Daylight-saving gaps and duplicated times require explicit conversion tests.

A future “follow device timezone” option can be previewed separately; it should not be the implicit behavior.

## Proposed implementation sequence

### Phase A — Contract and test harness

No user-facing behavior change.

1. Establish the migration baseline and environment workflow.
2. Generate Supabase types and type the client boundaries.
3. Add local schema reset/verification and RLS ownership tests.
4. Add CI commands for migration, type, application, and Edge Function checks.

### Phase B — Backward-compatible metadata

Separately approved database migration.

1. Add update triggers, revisions, settings version, and deletion tombstones.
2. Add lifecycle timestamp columns without switching the UI.
3. Backfill in measured batches and publish read-only validation counts.
4. Keep the current client compatible throughout the migration window.

### Phase C — Sync engine transition

Internal behavior change with failure-state previews before activation.

1. Persist outbox and pull cursors locally.
2. Add optimistic writes and conflict preservation.
3. Replace full pulls with table deltas behind a feature flag.
4. Test reload while offline, two-device concurrent edits, deletion/restore, interrupted upload, and stale clients.
5. Retain a kill switch that returns to read-only cloud sync during rollout.

### Phase D — Product lifecycle and timezone behavior

Requires separate visual approvals.

1. Preview Completed, Archive, Trash, Restore, and permanent deletion flows.
2. Preview conflict/recovery messaging.
3. Preview fixed planning timezone and travel behavior.
4. Activate the new fields only after those product decisions are approved.

## Approval boundaries

The following approvals should remain separate:

1. Phase A repository/tooling changes.
2. Phase B database/RLS migration.
3. Phase C synchronization behavior and recovery states.
4. Task lifecycle UI and retention behavior.
5. Timezone/travel behavior and calendar migration.

## Recommended first approval

Approve Phase A only: migration baseline, generated types, and an RLS test harness. It creates the safety rails needed to review every later migration without changing Tempo's visible behavior or existing data.
