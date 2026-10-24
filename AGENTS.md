# Tempo: working agreement

Before planning or changing Tempo, read `docs/PROJECT_STATE.md` completely.

## Mandatory workflow

1. Inspect the current implementation and the latest project state.
2. Prepare a visual preview for each user-facing feature or substantial UI change.
3. Show relevant desktop, responsive, empty, loading, error, and populated states.
4. Wait for explicit user approval of the preview before implementation.
5. Implement only the approved scope; do not silently add adjacent features.
6. Verify the result with appropriate tests and visual checks.
7. Update `docs/PROJECT_STATE.md` in the same work session with decisions, files changed, verification, remaining work, and the next recommended step.

No preview approval means no implementation. Internal fixes that do not affect behavior or UI still require a written proposal before modification unless the user explicitly authorizes immediate implementation.

## Durable context

The repository files are the source of truth, not chat memory. At the start and end of every work session, reconcile the conversation with `docs/PROJECT_STATE.md`. Never mark an item complete without verification evidence. Never remove pending work merely because it was deferred.

## Safety

- Never commit credentials or copy values from `.env.local` into documentation, logs, screenshots, or source files.
- Preserve the local-first behavior and existing user data unless an approved feature explicitly changes them.
- Treat database migrations and RLS changes as separately reviewable work.
