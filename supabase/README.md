# Supabase workflow for Tempo

The Supabase CLI is pinned in `devDependencies`. Use the repository commands so every environment runs the same version.

## Local verification

Docker must be running.

```powershell
npm run db:start
npm run db:reset
npm run db:types:check
npm run test:rls
npm run db:stop
```

`db:reset` builds a fresh local database exclusively from `supabase/migrations/`. The database suite creates temporary users and rows inside transactions and rolls everything back. It currently runs 23 RLS assertions plus 20 Phase B metadata assertions.

## Generated database contract

Generate from the linked remote project without changing it:

```powershell
npm run db:types
```

Generate from the running local database:

```powershell
npm run db:types:local
```

Both commands update:

- `src/lib/database.types.ts`
- `supabase/functions/_shared/database.types.ts`

Credentials are read from process environment variables or `.env.local`. The generator never writes them to source files.

## Existing remote project baseline

`20261020000000_remote_baseline.sql` reproduces the schema for a fresh local database. It intentionally aborts if `public.profiles` already exists, preventing accidental replay over Tempo's initialized remote project.

Before the first future remote migration, the baseline version must be recorded as already applied. This changes only Supabase migration history and therefore requires explicit database approval at action time:

```powershell
npx supabase link --project-ref <project-ref>
npx supabase migration repair 20261020000000 --status applied --linked
npx supabase migration list --linked
```

Do not run `db push` against the remote project until the migration list shows the baseline on both local and remote sides.

## Adding a migration

1. Create one timestamped SQL file with `npx supabase migration new <name>`.
2. Keep structural DDL and large data backfills separately reviewable when practical.
3. Reset the local database and run RLS tests.
4. Regenerate types from local and run the complete application verification.
5. Review backup and recovery steps before applying the migration remotely.
6. Remote `db push`, RLS changes, and migration-history repair always require a separate approval.

The Phase B impact check, deployment gate, and recovery strategy are documented in `docs/PHASE_B_MIGRATION_RUNBOOK.md`.
