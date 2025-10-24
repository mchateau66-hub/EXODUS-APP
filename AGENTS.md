# Repository Guidelines

## Project Structure & Module Organization
Next.js 15 App Router code lives in `src/app`, covering route segments, the paywall UI, and middleware protecting `/pro`. API handlers sit in `src/app/api` (health, login, logout) and reuse helpers in `src/lib` such as `jwt.ts`. Global assets belong in `public/`, with shared styling in `src/globals.css`. Keep Playwright specs under `e2e/`; generated artefacts in `test-results/` or `playwright-report/` can be pruned after debugging. Preserve `.off` config files as opt-in templates—rename them only when you truly re-enable the feature.

## Build, Test & Development Commands
Run `pnpm install` once, then `pnpm dev` to start the app (set `PORT=3005` if the default port is busy). `pnpm build` compiles for production; `pnpm start` serves the optimized build. Use `pnpm lint` and `pnpm typecheck` before pushing; the CI pipeline runs both plus Playwright. Execute `pnpm exec playwright test` (or `--ui` while debugging) from the repo root for smoke checks.

## Coding Style & Naming Conventions
Code is TypeScript-first with 2-space indentation, semicolons, and single quotes (`'`) in server modules; client JSX follows the Next.js defaults. Avoid `any`: `eslint.config.mjs` enforces `@typescript-eslint/no-explicit-any`. Keep App Router folders lowercase (`src/app/paywall`), reserve PascalCase for reusable components, and park shared utilities in `src/lib`.

## Testing Guidelines
Playwright is the canonical suite. Store new specs under `e2e/` and prefer descriptive file names (`feature-name.spec.ts`). Lean on helpers in `e2e/helpers.ts` for auth cookies, redirects, and health checks instead of duplicating logic. Tag critical elements with stable `data-testid` attributes as in the paywall flow, and call out required `E2E_*` env vars in scenario notes.

## Commit & Pull Request Guidelines
Follow the Conventional Commit style in history (`ci(e2e): …`, `chore: …`). Subject lines stay under 72 characters and explain intent. For PRs, add a short changelog, link the issue, mention env or schema updates, and attach Playwright HTML or screenshots when UI behaviour shifts. Note the lint, typecheck, and Playwright status so reviewers know the branch is green.

## Security & Configuration Tips
Never commit secrets: `.env.local` is ignored—set `JWT_SECRET` and `SESSION_TTL_S` locally. If you re-enable the Prisma postinstall hook, confirm `prisma/schema.prisma` exists so CI stays quiet. Middleware guards `/pro`; keep defensive cookie flags (`Secure`, `SameSite=Lax`) intact when adjusting auth flows. Rotate any demo credentials referenced in docs or issues.
