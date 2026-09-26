# Demo Script

## Current status

P1-S1 implements the synthetic local demo below. Run `pnpm.cmd run demo:p1`,
open `http://127.0.0.1:3000`, and stop with Ctrl+C. This is not authorized for
real care data or public deployment.

## Slice 1 target — coordinated daily task

1. Select English or Vietnamese.
2. Open a synthetic household dashboard.
3. Show an honest empty or preloaded task state.
4. As Lan (creator/coordinator), create a neutral task for the synthetic care
   recipient and assign Minh.
5. Show the API success state and correlation-safe UI feedback.
6. Show the new task on the dashboard/task board.
7. Switch to Minh and complete the task with optimistic concurrency.
8. Show Care-owned pending/retrying/delivered state separately from task
   completion.
9. Switch to Lan and show exactly one durable completion notification; show
   that Minh did not notify themself.
10. Switch VI/EN and open the confirmed task detail/dashboard projection.
11. Demonstrate validation, offline blocking, conflict, or Notification
    degradation without losing valid input or fabricating a delivery.

## Evidence required before using this script

- Stitch design and accessibility review for the three slice screens.
- End-to-end test against the exact build.
- Synthetic fixture provenance and both locale paths.
- Health checks and production-like local start.
- No secret in repository, browser console, logs, screenshots, or recording.
- Known limitations disclosed.

## Rehearsal record

Record date, commit, environment, duration, result, deviations, and follow-up in
`docs/SESSION_LOG.md`. A rehearsal is not complete until performed against the
same release candidate being submitted.
