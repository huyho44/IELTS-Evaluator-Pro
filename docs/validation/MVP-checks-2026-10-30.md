# MVP validation — 2026-10-30

Branch checked: `main`. Node runtime tested: `v24.21.0`. No commit or remote deployment was made by this task.

| Check | Result |
| --- | --- |
| Backend TypeScript, including scripts and specs | Passed: `npx tsc --noEmit --incremental false -p tsconfig.json` |
| Backend lint | Passed with no warnings: `npm run lint` |
| Backend regular suite | 133 passed; 19 opt-in PostgreSQL tests skipped by this command |
| Isolated PostgreSQL integration | All 19 passed separately through `npm run test:integration` |
| Backend production build | Passed; output entrypoints `dist/main.js`, `dist/worker.js` |
| Frontend production build and lint | Both passed |
| Frontend regression scripts | All 5 passed: session, catalog, instructor, student-learning, course-completion |
| Live local API smoke | 11 endpoint checks passed using Student, Instructor and Admin; learner access to operational reports denied |
| Compose configuration | `docker compose --env-file .env.mvp.example -f compose.mvp.yml config --quiet` passed |
| Evaluation offline replay | Synthetic dev, holdout and recommendation comparison artifacts generated successfully |
| Diff whitespace | `git diff --check` passed |

The integration runner provisioned a new randomly named local `*_test` database, applied the three canonical migrations, seeded it and removed only that disposable database afterward. Ordinary project data was not reset. Integration scenarios include concurrent repeated submissions, stale drafts/claims, publication timing, appeals, invalid evidence, invalid AI output, objective answer keys, transient provider retry, expired worker lease recovery, lost/pending outbox reconciliation, and flagged-feedback isolation. Unit tests also cover management permissions, last-admin protection, prerequisite cycles, immutable revision lifecycle and recommendation ownership/version eligibility.

An additive idempotent seed was run against the current development database to install the Writing Clinic, 6 Writing skills and 6 activities. Existing matching accounts, passwords and business records were preserved. API smoke testing created/revoked test login sessions and generated normal profile/recommendation snapshots; it did not consume learner attempts. The temporary API process on port 3100 was stopped after verification.

## Limits of this evidence

- AI transport protocol tests use mocked HTTP. No paid provider request or real scoring-accuracy validation was run because no real provider credential/model was configured for this task.
- [Synthetic dev](synthetic-dev.json), [synthetic holdout](synthetic-holdout.json) and [synthetic recommendation comparison](synthetic-policy-comparison.json) demonstrate the evaluation pipeline only. Their numeric metrics are not expert accuracy or learning-effect evidence.
- Docker daemon was unavailable (`dockerDesktopLinuxEngine` pipe missing). Images, HTTPS issuance and VPS deployment were not executed.
- Frontend scripts test logic and API contracts; an interactive browser acceptance test and actual participant study were not completed.
- Node-postgres emitted a deprecation warning about concurrent queries on a transaction connection during integration; all current tests passed. Package versions were not upgraded as part of the MVP.

For test scenarios and external acceptance work, see [MVP guide](../MVP.md), [evaluation protocol](../evaluation.md) and [deployment guide](../deployment.md).
