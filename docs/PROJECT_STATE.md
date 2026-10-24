# Tempo — persistent project state

Last updated: 2026-10-24

This document is the durable handoff between long sessions and future chats. It records what Tempo already contains, what has been decided, what has actually been implemented, and what remains. Update it after every approved implementation or material product decision.

## Working agreement

- Always preview user-facing features before implementation.
- Preview first, discuss and revise, obtain explicit approval, then implement.
- Keep previews separate from production code until approval.
- After implementation, verify the feature and update this file.
- A chat summary is helpful but is not the source of truth; this file is.

## Status vocabulary

- `DISCOVERY`: requirements or current behavior are still being examined.
- `PREVIEW`: visual proposal is being prepared or discussed.
- `APPROVED`: the user approved the proposed behavior and visual direction.
- `IMPLEMENTING`: code or database work is in progress.
- `VERIFYING`: implementation exists but verification is incomplete.
- `DONE`: implemented and verified.
- `DEFERRED`: deliberately postponed; still retained in the backlog.

## Current product baseline

Tempo is a personal, local-first time-blocking planner built with Vite, React, TypeScript, Zustand, Supabase synchronization/realtime, and PWA support.

Observed capabilities:

- Day, week, and month agenda views.
- Time blocks with drag and drop and overlap prevention.
- Tasks, Inbox, Today, routines, recurring series, priorities, planned and due dates.
- Spanish and English natural-language capture and automatic planning.
- Focus mode with document picture-in-picture.
- Review and weekly statistics.
- Search/command palette.
- In-app PWA notifications while Tempo is active.
- Google Calendar implementation exists behind a gate.
- MCP bridge exists.

Known technical constraints:

- The current Supabase schema now has a guarded versioned baseline for fresh local environments; its remote migration-history registration is deliberately pending separate approval.
- Generated Supabase types are now the application and Edge Function database contract.
- `tasks.archived` currently conflates completion and archive semantics.
- Deletion is hard-delete; there is no trash lifecycle.
- Synchronization pulls whole tables and resolves conflicts with last-write-wins behavior.
- Collaboration is not ready; current RLS is based on per-user ownership.
- Wall-clock block time is intentionally stored as text and needs an explicit timezone policy before expansion.
- Settings are stored in profile JSON.
- Spanish and English share a lightweight translation layer. German, French, and Italian still require extending the language types, copy catalog, and parser keywords.
- The current `#Trabajo` concept is a classification/list, not a first-class tag system.

## Backend access audit

Status: `DONE` (read-only validation only)

- Supabase Auth API access validated.
- Supabase Management API project identity validated.
- PostgreSQL pooler connection validated.
- Public tables observed: `blocks`, `tasks`, `lists`, `profiles`, `app_daily_activity`, `app_user_metrics`, `calendar_connections`, `calendar_oauth_states`, `calendar_sync_state`.
- Snapshot observed on 2026-10-17: 7 profiles, 39 lists, 92 tasks, 2,846 blocks, 0 calendar connections, 55 activity rows.
- No database mutations were made during the audit.
- Credentials remain only in local environment files and are not recorded here.

## Product direction

Keep Tempo centered on personal time blocking rather than reproducing every feature of a general task manager. Features inspired by the supplied references should be adapted to Tempo's planning flow and visual language.

## Roadmap and preview queue

| Order | Area | Status | Preview required | Notes |
|---:|---|---|---|---|
| 0 | Foundations and data safety | Phase A `DONE`; Phase B local `DONE`; remote `READY FOR APPROVAL` | Baseline history repair and remote Phase B deployment require separate approvals | The additive migration is verified locally. A protected logical backup was restored successfully, satisfying the recovery gate. Supabase remote remains unchanged. |
| 1 | Settings shell, language and regional preferences | DONE | Approved panel and complete English pass implemented and verified | Spanish and English infrastructure is active. Build, tests, static checks, desktop and 390×844 browser sweeps pass. Settings preview, Activity, and Appearance are fully localized for the approved scope. |
| 1.5 | Previous-day overdue cleanup | VERIFYING | Preview approved and implementation passed automated verification; focused browser check remains | Marks only editable planned blocks before today as skipped/no realizado, preserves history, returns one-time tasks to Pending, keeps recurring tasks and future occurrences, and offers an operation-specific Undo. |
| 2 | Advanced task model | DISCOVERY | Task editor, list views, lifecycle states | Statuses, trash, sections, first-class tags, checklist, smart lists, saved filters, grouping, ordering, and search. |
| 3 | Planning views | DISCOVERY | List/Kanban, enhanced calendar, agenda, Eisenhower | Preserve time-blocking as the primary workflow. |
| 4 | Habits, countdowns, and analytics | DISCOVERY | Dashboard, detail, edit, empty states | Habits should integrate with the calendar and review rather than become a disconnected module. |
| 5 | Reminders and integrations | DISCOVERY | Notification settings and connection flows | Browser/desktop limitations and calendar sync behavior must be explicit. |
| 6 | Collaboration | DEFERRED | Sharing, permissions, activity states | Requires a deliberate ownership, RLS, conflict, and audit model first. |
| 7 | AI, desktop extras, premium packaging | DEFERRED | Separate previews per capability | Only after the core planning and data model are stable. |

## Decisions recorded

1. Spanish and English are the first implementation languages.
2. German, French, and Italian must be easy to add later but are not part of the first translation pass.
3. Every user-facing feature must be previewed and explicitly approved before implementation.
4. Project status must persist in the repository so long sessions, compaction, and future chats do not lose work or pending items.
5. No functionality or database schema has been changed as part of the discovery and Supabase audit.
6. The overlaid side-panel layout is the approved visual direction for Settings, Language & Region. The dedicated-page alternative is not selected.
7. Settings use explicit Save changes / Discard behavior. Closing the panel discards its unsaved draft.
8. Phase A of Foundations and data safety was approved: repository tooling and safety rails only, with no remote schema or user-data mutation.
9. Phase B was approved for local implementation only. Remote migration-history repair and deployment remain separate approvals.
10. A manual pre-Phase-B logical backup outside the repository was approved, created, access-restricted, hashed, and successfully restored into a disposable local database.
11. Previous-day cleanup was approved: it affects only editable planned blocks dated before today, records them as not done/skipped instead of deleting them, leaves today untouched, returns one-time tasks to Pending, preserves recurring tasks and future dates, and offers Undo.

## Next proposed step

Complete the focused desktop and mobile browser check for previous-day cleanup, then move it from `VERIFYING` to `DONE`.

After that, the next backend step remains a separately approved first remote write: register baseline migration `20261020000000` as already applied without executing its SQL, then verify the remote migration list. Applying Phase B migration `20261021000000` remains a second, separate approval after that verification.

Database metadata, synchronization behavior, task lifecycle, and timezone behavior remain separate later approvals. No remote schema change or user-data mutation is approved.

## Implementation log

### 2026-10-24 — Implemented: previous-day overdue cleanup

- User approved the interactive preview and its confirmation flow.
- Added a `Limpiar` / `Clean up` action to the Activity panel when editable planned blocks exist on dates before today.
- Added a confirmation dialog with block, task, day, and date-range scope; it explicitly states that today is unchanged and no task or history record is deleted.
- The operation atomically marks matching blocks as `skipped`, records `closedAt`, returns affected one-time tasks to Pending, and leaves recurring tasks, breaks, completed blocks, today's blocks, and read-only external calendar events unchanged.
- Added an operation-specific Undo snapshot that restores only the affected block status/closure metadata and one-time task archive flags; cloud synchronization is held and flushed safely during Undo.
- Split Activity presentation so previous-day unresolved blocks have the cleanup action while today's unresolved blocks remain visible in a separate section.
- Files added: `src/lib/overdue.ts`.
- Principal files updated: `src/store.ts`, `src/components/NowPanel.tsx`, and `tests/planning.test.ts`.
- Verification passed: production build, 21/21 application tests, and all 6 Edge Function static checks.
- Focused browser verification remains pending because the in-app browser security policy rejected observation of the active localhost page; no workaround was attempted.
- Database schema changed: none. Remote Supabase writes performed: none. No user data was modified during automated verification.

### 2026-10-21 — Verified pre-Phase-B logical backup

- User approved creation of a logical backup outside the repository.
- Created `roles.sql`, `schema.sql`, and `data.sql` under `D:\4. App Desarrollo\APP - Time Blocking\tempo-backups\pre-phase-b-20261021-122911` using the repository-pinned Supabase CLI.
- Recorded SHA-256 hashes and restore evidence in the backup's `MANIFEST.txt`.
- Restricted the backup directory and files to the current Windows account because the dump contains authentication and user data.
- Restored the schema and data transactionally into a disposable local Supabase PostgreSQL database.
- Restored counts matched the remote source: 7 users/profiles, 39 lists, 92 tasks, 20 legacy-archived tasks, 2,840 blocks, and 57 activity rows.
- Referential verification found zero orphan profiles, tasks, or blocks.
- Removed the disposable verification database and temporary container copies; the primary local Supabase database remained healthy.
- Remote Supabase writes performed: none. Recovery gate status: `PASS`.

### 2026-10-21 — Read-only remote preflight for Phase B

- Queried the remote project with the Management API `read_only` guard and used read-only Supabase CLI commands. No schema, data, migration history, or project configuration was changed.
- Current counts: 7 profiles, 39 lists, 92 tasks, 20 legacy-archived tasks, 2,840 blocks, 0 calendar connections, and 57 daily activity rows.
- PostgreSQL reports a total database size of 14 MB.
- Confirmed Phase B is absent remotely: `tasks.revision` does not exist.
- Confirmed both local migrations are pending in remote migration history; the baseline must be registered as applied and must never be replayed remotely.
- Recovery gate failed: physical-backup infrastructure is enabled, but PITR is disabled and the backup listing is empty.
- Added `docs/PHASE_B_REMOTE_PREFLIGHT.md`. The remote rollout is `BLOCKED` until a restorable backup is created and verified.
- Remote Supabase writes performed: none. Credentials were not recorded.

### 2026-10-21 — Implemented locally: Foundations and data safety Phase B

- Approval scope: local implementation and verification only. No remote migration or data change was authorized.
- Added `20261021000000_add_sync_metadata.sql`, an additive migration for synchronized entities.
- Added server-maintained revisions and `updated_at` triggers to `profiles`, `lists`, `tasks`, and `blocks`.
- Added `profiles.settings_version`; added dormant `deleted_at` tombstones; added dormant task `completed_at` and `archived_at` lifecycle timestamps.
- Preserved compatibility: `is_archived` remains authoritative, deletes remain physical, full-table sync remains active, and the application does not read or write the new lifecycle fields.
- The migration captures row counts, validates them after DDL, verifies initial metadata values, and aborts transactionally on an invariant failure.
- Added `supabase/tests/metadata.sql` with 20 assertions for column presence, default versions, server revision control, timestamps, and dormant lifecycle state. The existing 23 RLS assertions remain unchanged.
- Added `docs/PHASE_B_MIGRATION_RUNBOOK.md` with the read-only impact query, remote deployment gate, and recovery strategy.
- Regenerated both Supabase database contracts from the local schema.
- Verification passed: fresh local reset, production build, 20/20 application tests, 6/6 Edge Function checks, generated-contract comparison, and 43/43 database assertions.
- Application UI/behavior changed: none. Remote Supabase schema changed: none. Remote Supabase data changed: none.

### 2026-10-21 — Verified: Foundations and data safety Phase A

- Docker Desktop became available and the local Supabase stack was rebuilt from a clean data volume.
- A fresh `db:reset` reproduced `20261020000000_remote_baseline.sql` successfully.
- Corrected a Supabase CLI Windows compatibility issue in the type generator: it now reads the active local `DB_URL` from `supabase status` and passes it explicitly to `gen types`, without recording credentials in the repository or logs.
- Regenerated both database contracts from the clean local schema and tightened the settings JSON adapter to the generated non-null database type.
- Integrated verification passed with one command: production build, 20/20 application tests, 6/6 Edge Function static checks, generated-contract comparison, and 23/23 pgTAP RLS assertions.
- Phase A status is now `DONE`. Phase B remains preview-only and requires explicit approval.
- Remote Supabase schema changed: none. Remote Supabase data changed: none. Application UI/behavior changed: none.

### 2026-10-21 — Preview: Foundations and data safety Phase B

- Prepared an interactive technical preview of the backward-compatible metadata migration.
- Proposed scope: server-maintained `updated_at`, integer revisions, `settings_version`, deletion tombstones, and lifecycle timestamps added without removing existing columns or activating new UI behavior.
- Explicitly excluded from Phase B: durable outbox, incremental sync, conflict UI, trash/restore UI, permanent-deletion behavior, and timezone changes.
- Proposed safety gate: read-only impact counts, local migration/reset, regenerated types, RLS tests, application verification, and a documented recovery procedure before any remote execution.
- Docker was checked again and still reports no Linux engine, so Phase A local database verification remains pending.
- Approval status: preview only; Phase B is not approved or implemented.
- Application code changed: none. Remote Supabase schema changed: none. Supabase data changed: none.

### 2026-10-21 — Implemented: Foundations and data safety Phase A

- Added the guarded migration baseline `supabase/migrations/20261020000000_remote_baseline.sql`. It builds a fresh local database and intentionally aborts if replayed over an initialized Tempo schema.
- Added generated Supabase contracts for the React application and Edge Functions, typed the Supabase clients, and replaced permissive synchronization row mappings with generated row/insert types and validated enum conversions.
- Added a reproducible type generator that reads credentials only from process environment or `.env.local`, uses the repository-pinned Supabase CLI, strips non-contract CLI output, and updates/checks both generated contracts.
- Added a 23-assertion pgTAP RLS suite covering per-user visibility and CRUD, calendar-secret isolation, admin metrics, activity ownership, and anonymous access.
- Added repository commands for local Supabase lifecycle, reset, type generation/checking, RLS tests, and complete verification; added a pull-request/manual GitHub Actions workflow for application and database-contract jobs.
- Added `supabase/README.md` with the local workflow and the deliberately unexecuted remote baseline-history procedure. Remote repair and `db push` still require separate approval.
- Pinned Supabase CLI `2.121.0`. Dependency audit updated Vite to `6.4.4` and `source-map-js` to `1.2.2`; `npm audit` reports zero known vulnerabilities.
- Verification passed: production build, 20/20 application tests, all 6 Edge Function static checks, generated remote type contract, and `git diff --check`.
- Historical note: Docker was unavailable during the implementation session, so database verification was initially pending. It was completed later on 2026-10-21; see the verification entry above.
- Application UI/behavior changed: none. Remote Supabase schema changed: none. Supabase user data changed: none.
- Phase A was initially left as `VERIFYING`; it is now `DONE` after the local database checks passed.

### 2026-10-20 — Preview: Foundations and data safety architecture

- Inspected the current schema, Zustand persistence, Supabase synchronization, task lifecycle, timezone helpers, recurrence logic, Google Calendar import, and existing test commands.
- Confirmed the principal risks: monolithic manual schema, no generated database contract, no automated RLS ownership suite, unversioned cloud settings JSON, in-memory-only sync snapshot, full-table pulls, no optimistic concurrency, hard deletion, conflated completion/archive semantics, and device-timezone-dependent clock behavior.
- Prepared `docs/FOUNDATIONS_DATA_SAFETY_REVIEW.md` with seven recommended decisions, four implementation phases, migration safety rules, acceptance boundaries, and the impact on current data.
- Recommended first approval: Phase A repository/tooling safety rails only.
- Application code changed: none. Database schema changed: none. Supabase data changed: none.
- Stage 0 status is now `PREVIEW`; implementation is waiting for explicit approval.

### 2026-10-20 — Completed: residual English copy fixes and Stage 1 closure

- Localized the Activity actions `Modo Enfoque` / `Flotante` as `Focus mode` / `Floating`, including the floating-window help text.
- Added explicit English names and descriptions for all six Appearance themes without changing their stable persisted IDs.
- Made the Settings close control follow the unsaved language preview, so it changes to `Close` immediately with the draft instead of waiting for Save.
- Files updated: `src/components/NowPanel.tsx`, `src/components/Modal.tsx`, `src/components/SettingsPanel.tsx`, and `src/lib/themes.ts`.
- Verification: production build passed; 20/20 automated tests passed; all 6 Edge Functions passed static checks.
- Focused browser verification passed at desktop width and 390×844. English draft close label, all translated themes, and Activity actions were visibly verified; the mobile viewport had no global horizontal overflow and the browser console contained no warnings or errors.
- Restored the user's original preferences after verification: Spanish, Argentina regional format, Buenos Aires timezone, 24-hour clock, and Monday week start.
- Data safety: no tasks, blocks, classifications, or Supabase rows were created, edited, or deleted. Database schema changed: none.
- Stage 1 status is now `DONE`.

### 2026-10-20 — Verification: desktop and responsive English sweep

- Exercised the live local application through the browser at desktop width and an explicit 390×844 viewport.
- Verified Settings draft discard, English save, `en-US` date formatting, 12-hour clock, Sunday week start, persistence, and restoration to the original Spanish/Argentina/24-hour/Monday preferences.
- Verified Search, Tasks and routines, task editor, Arrange, Review/Close/Tomorrow/Week/History, block General/Notes/Series, Focus mode, Administration metrics, all Settings sections, mobile Plan/Review/Focus/Activity navigation, and Day/Week/Month responsive views.
- Responsive result: no global horizontal overflow at 390×844; Settings occupies the viewport without overflow; mobile Day, Week, and Month views render and remain navigable.
- Runtime result: no browser console warnings or errors were recorded during the sweep.
- Data safety: no task, block, classification, or Supabase row was created, edited, or deleted. Only preferences were temporarily changed and then restored.
- Defects found: Activity still shows `Modo Enfoque` and `Flotante` in English; Appearance theme names/descriptions (`Claro`, `Porcelana y pino`, etc.) remain in Spanish in English mode; while English is only an unsaved Settings draft, the panel title previews as `Settings` but the close control remains `Cerrar` until the preference is saved.
- Existing Spanish task, list, and block titles intentionally remain unchanged because they are user data.
- Stage status remains `VERIFYING`; focused fixes and a small recheck are required.

### 2026-10-20 — Implemented: complete English application pass

- Extended the approved Spanish/English setting across the active application shell and feature panels: sidebar, toolbar, timer, command palette, focus mode, onboarding, shared modals, Now panel, day/week/month planner, block and task editors, review/activity/statistics, automatic planning, integrations, administration, authentication, synchronization notices, notifications, and floating focus mode.
- Added English natural-language capture for `today`, `tomorrow`, duration, priority, tags/classifications, and due dates. Short numeric dates use month/day for `en-US` and day/month for other supported locales.
- Localized generated activity history, notification text, default names for newly created breaks/blocks, MCP export instructions and validation errors, authentication errors, Google Calendar UI failures, and administration diagnostics.
- Kept existing user-created titles and seeded content unchanged; language switching never rewrites user data.
- Files added: none.
- Principal files updated: `src/App.tsx`, `src/store.ts`, `src/lib/i18n.ts`, `src/lib/taskCapture.ts`, `src/lib/history.ts`, `src/lib/supabase.ts`, `src/lib/sync.ts`, `src/lib/mcpBridge.ts`, `src/lib/documentPip.ts`, `src/hooks/useClockEngine.ts`, and the active components under `src/components/`.
- Verification: production build passed; 20/20 automated tests passed, including English capture and US date ordering; all 6 Edge Functions passed static checks.
- Visual verification: not completed in this session. The in-app browser was open at `http://127.0.0.1:5173/tempo/`, but its security policy rejected localhost observation. No workaround was attempted and no screenshot is claimed.
- Database schema changed: none. No Supabase data mutation was performed.
- Known incomplete work: one manual desktop/narrow visual sweep is required before Stage 1 can move from `VERIFYING` to `DONE`. `src/components/SettingsModal.tsx` is a legacy unused settings implementation; production loads `SettingsPanel.tsx`.

### 2026-10-17 — Implemented: Settings panel and regional preferences

- Implemented the approved overlaid side-panel navigation with responsive horizontal navigation on narrow screens.
- Added explicit draft behavior: Save changes applies the draft, Discard and closing restore the saved values.
- Added independent persisted settings for app language, regional locale, IANA timezone, 12/24-hour format, and first day of week.
- Added Spanish/English translation infrastructure designed to accept more languages later.
- Applied language and regional formatting to Settings, top navigation, mobile navigation, calendar/month headings, and core clock displays.
- Preserved existing preferences, PWA controls, integrations, account controls, and profile JSON synchronization.
- Existing persisted profiles receive defaults for the new fields without a database migration.
- Files added: `src/components/SettingsPanel.tsx`, `src/lib/i18n.ts`.
- Principal files updated: `src/App.tsx`, `src/types.ts`, `src/store.ts`, `src/lib/time.ts`, `src/components/PwaSettings.tsx`, `src/components/TopBar.tsx`, `src/components/MobileNav.tsx`, `src/components/MonthView.tsx`, and time-presenting planner components.
- Verification: production build passed; 19/19 automated tests passed; all 6 Edge Functions passed static checks.
- Visual verification: desktop and 390×844 responsive layouts checked; Spanish-to-English draft change, 12-hour format, Sunday week start, Save enabling, saved shell language, and date/time preview verified.
- Database schema changed: none. Settings continue to sync through `profiles.settings` JSON.
- Known incomplete work: several pre-existing feature panels and natural-language helpers still contain Spanish-only copy. English is not yet complete across the whole application.

### 2026-10-17 — Preview: Settings, Language & Region

- Prepared two interactive alternatives: an overlaid settings panel and a dedicated settings page.
- The preview includes Spanish/English switching, regional format, timezone, 12/24-hour format, week start, explicit save/discard behavior, responsive layouts, and a saved confirmation state.
- Navigation decision: overlaid side panel approved by the user.
- Save behavior decision: explicit Save changes / Discard approved.
- Approval status: visual direction and save behavior approved; implementation completed for the settings panel and core regional formatting.
- Application code changed: none.
- Database changed: none.

### 2026-10-17 — Discovery and access validation

- Reviewed the existing application and supplied product references.
- Validated read-only access to the Supabase project and database.
- Established the preview-before-implementation rule and this durable project-state protocol.
- Application code changed: none.
- Database changed: none.
- Remaining: prepare and review the first feature preview.

## Session handoff checklist

At the end of each session, add or update:

- What was approved.
- What was implemented and the exact scope.
- Files and migrations changed.
- Tests, builds, and visual checks performed.
- Known defects or incomplete states.
- Pending decisions.
- The next smallest useful step.
