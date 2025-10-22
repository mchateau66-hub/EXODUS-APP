<!-- Badges CI -->
[![CI Lint & Typecheck](https://github.com/mchateau66-hub/EXODUS-APP/actions/workflows/ci-lint-typecheck.yml/badge.svg?branch=main)](https://github.com/mchateau66-hub/EXODUS-APP/actions/workflows/ci-lint-typecheck.yml)
[![E2E Playwright](https://github.com/mchateau66-hub/EXODUS-APP/actions/workflows/e2e-playwright.yml/badge.svg?branch=main)](https://github.com/mchateau66-hub/EXODUS-APP/actions/workflows/e2e-playwright.yml)

# EXODUS-APP

- [Structure](#-structure-extrait)
- [Fonctionnalités en place](#-fonctionnalités-en-place)
- [Démarrer en local](#-démarrer-en-local)
- [Tests E2E](#-tests-e2e-playwright)
- [Contrat Paywall](#-contrat-paywall-rappel)
- [Scripts](#-scripts-utiles)
- [CI](#-ci)
- [ESLint ignores](#-eslint-flat-config--ignores)
- [Dépannage](#-dépannage)
- [Roadmap](#-roadmap-courte)

Application **Next.js 15 (App Router)** avec **paywall** protégé par middleware, E2E Playwright et CI GitHub Actions.

- **Stack** : Next.js 15 • Node 20 • pnpm • Playwright  
- **Déploiement** : Vercel (Hobby, région IAD1, Fluid Compute ON)

---
<a id="structure"></a>
## 📦 Structure (extrait)

src/
app/
api/
health/route.ts # GET 200
login/route.ts # POST -> Set-Cookie: session
logout/route.ts # POST 204
paywall/page.tsx # Page paywall (data-testid="paywall")
middleware.ts # protège /pro/:path*
e2e/
helpers.ts # helpers (health, login, assertions…)
paywall.spec.ts # tests paywall (anon, cookie, Bearer)

---

## ✅ Fonctionnalités en place

- **API health** : `GET /api/health` → `200 OK`
- **API login** : `POST /api/login`  
  Pose un cookie `session`. Body optionnel : `{"maxAge": 600}` (secondes).
- **API logout** : `POST /api/logout` → `204 No Content` (invalide la session)
- **Middleware paywall** : protège **`/pro/:path*`**
  - passe si **cookie `session`** ou **`Authorization: Bearer <token>`**
  - sinon → **`307`** vers **`/paywall?paywall=1&from=<path>`** + header **`x-paywall: 1`**

> La page `/paywall` expose `data-testid="paywall"` pour les E2E.

---

<a id="scripts-utiles"></a>
## 🛠️ Scripts utiles

```bash
pnpm dev
pnpm build && pnpm start
pnpm lint
pnpm tsc --noEmit
pnpm exec playwright test
pnpm exec playwright test -g paywall
```
---

## 🏁 Démarrer en local

```bash
pnpm i

# utiliser un port libre pour éviter les surprises
PORT=3005 pnpm dev
# ➜ Ready on http://localhost:3005
