# Repository Guidelines

## Project Structure & Module Organization

- `backend/`: NestJS API and grading worker. Feature modules live in `src/`; Prisma schema, migrations, and seeds in `prisma/`; end-to-end tests in `test/`.
- `frontend/`: React, TypeScript, Vite, and Tailwind. Feature screens and APIs live in `src/features/`, shared components in `src/components/`, assets in `src/assets/` and `public/`, and checks in `scripts/`.
- `docs/`: MVP workflows, evaluation, and deployment guides. `deployment/` and `compose.mvp.yml` contain production configuration; `docker-compose.yml` provides development services.

## Build, Test, and Development Commands

Use Node.js 24. Run npm commands from the relevant package directory; there is no root npm package.

- Root: `docker compose up -d postgres` starts PostgreSQL with pgvector on port 5433.
- Each package: `npm ci` installs locked dependencies; `npm run build` builds; `npm run lint` runs Oxlint.
- Backend setup: `npx prisma generate`, `npx prisma migrate deploy`, then `npm run db:seed` generate the client, apply migrations, and seed demo content.
- Backend: `npm run start:dev` starts the API on port 3000 with an embedded worker.
- Frontend: `npm run dev` starts Vite on port 5173.

## Coding Style & Naming Conventions

Use two-space indentation, TypeScript, and semicolons. Backend Prettier uses single quotes and trailing commas; run `npm run format` there. Preserve surrounding frontend quote style. Use PascalCase React components, camelCase helpers, and Nest filenames such as `courses.service.ts` and `register.dto.ts`. Preserve `.js` extensions in backend local imports.

## Testing Guidelines

Backend uses Vitest: `npm test` runs `*.spec.ts`; `npm run test:e2e` runs `test/*.e2e-spec.ts`. Place unit tests beside source. Add behavior-focused specs and extend relevant frontend checks when changing functionality. `npm run test:cov` reports coverage; no threshold is configured.

Run `npm run test:integration` for database changes; it creates and removes a disposable local database and needs database-creation privileges. Frontend checks include `node scripts/session-check.mjs` and `node scripts/student-learning-check.mjs`; see `README.md` for the full list. Run relevant checks, builds, and lint before submitting.

## Commit & Pull Request Guidelines

Follow existing Conventional Commit patterns: `feat(courses): ...`, `fix(grading): ...`, or `refactor: ...`. PRs should describe behavior changes, link relevant issues, list validation performed, and include screenshots for UI changes. Explain migrations and configuration changes.

## Security & Configuration

Create `backend/.env` from `backend/.env.example` only if absent. Configure `DATABASE_URL` and a random `AUTH_TOKEN_SECRET` of at least 32 bytes. Keep provider keys server-side and out of Git. Preserve instructor approval and publication rules for official grades and skill evidence.
