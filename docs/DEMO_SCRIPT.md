# Demo Script

## Current status

Phase 0 has no product demo. The sequence below is the acceptance target for the
first executable vertical slice and must not be presented as implemented.

## Slice 1 target — coordinated daily task

1. Select English or Vietnamese.
2. Open a synthetic household dashboard.
3. Show an honest empty or preloaded task state.
4. Create a task for a synthetic care recipient and assign a synthetic caregiver.
5. Show the API success state and correlation-safe UI feedback.
6. Show the new task on the dashboard/task board.
7. Show a notification intent created from the task event.
8. Complete the task with optimistic concurrency.
9. Show the completion in the timeline/audit projection.
10. Demonstrate one safe failure: denied access, validation, service unavailable,
    conflict, or offline queue—without losing valid input.

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
