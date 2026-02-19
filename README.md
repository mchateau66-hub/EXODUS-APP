<!-- Badges -->
[![CI – Lint & Typecheck](https://github.com/mchateau66-hub/EXODUS-APP/actions/workflows/ci-lint-typecheck.yml/badge.svg?branch=main)](https://github.com/mchateau66-hub/EXODUS-APP/actions/workflows/ci-lint-typecheck.yml)
[![E2E Playwright](https://github.com/mchateau66-hub/EXODUS-APP/actions/workflows/e2e-playwright.yml/badge.svg?branch=main)](https://github.com/mchateau66-hub/EXODUS-APP/actions/workflows/e2e-playwright.yml)
[![Vercel (prod)](https://img.shields.io/github/deployments/mchateau66-hub/EXODUS-APP/Production?label=vercel%20(prod)&logo=vercel&logoColor=white)](https://vercel.com/mchateau66-hub/exodus-app/deployments)
[![Live](https://img.shields.io/badge/live-Vercel-000?logo=vercel&logoColor=white)](https://exodus-app.vercel.app)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mchateau66-hub/EXODUS-APP)

# EXODUS-APP

- [Structure](#structure-extrait)
- [Fonctionnalités en place](#fonctionnalites-en-place)
- [Démarrer en local](#demarrer-en-local)
- [Tests E2E](#tests-e2e-playwright)
- [Contrat Paywall](#contrat-paywall-rappel)
- [Scripts utiles](#scripts-utiles)
- [CI](#ci)
- [ESLint ignores](#eslint-ignores-flat-config)
- [Dépannage](#depannage)
- [Roadmap](#roadmap-courte)

Application **Next.js 15 (App Router)** avec **paywall** protégé par middleware, E2E Playwright et CI GitHub Actions.

- **Stack** : Next.js 15 • Node 20 • pnpm • Playwright • TypeScript  
- **Déploiement** : Vercel (Hobby, région IAD1, Fluid Compute ON)

---

<a id="structure-extrait"></a>
## 📦 Structure (extrait)

```txt
src/
  app/
    api/
      health/route.ts         # GET 200
      login/route.ts          # POST -> Set-Cookie: session
      logout/route.ts         # POST 204
    paywall/page.tsx          # Page paywall (data-testid="paywall")
  middleware.ts               # protège /pro/:path*
e2e/
  helpers.ts                  # helpers (health, login, assertions…)
  paywall.spec.ts             # tests paywall (anon, cookie, Bearer)
  hub-myads.spec.ts
  hub-map.spec.ts
  utils/
    dump.ts
    leaflet.ts
    selectors.ts
```

---

<a id="fonctionnalites-en-place"></a>
## ✅ Fonctionnalités en place

- **API health** : `GET /api/health` → `200 OK`
- **API login** : `POST /api/login`  
  Pose un cookie `session`. Body optionnel : `{"maxAge": 600}` (secondes).
- **API logout** : `POST /api/logout` → `204 No Content`
- **Middleware paywall** : protège **`/pro/:path*`**
  - passe si **cookie `session`** ou **`Authorization: Bearer <token>`**
  - sinon → **`307`** vers **`/paywall?paywall=1&from=<path>`** + header **`x-paywall: 1`**

> La page `/paywall` expose `data-testid="paywall"` pour les E2E.

---

<a id="demarrer-en-local"></a>
## 🏁 Démarrer en local

```bash
pnpm i
pnpm exec playwright install --with-deps
PORT=3005 pnpm dev
```

---

<a id="tests-e2e-playwright"></a>
## 🧪 Tests E2E (Playwright)

### Nettoyer avant un run
```bash
rm -rf test-results playwright-report
```

### Lancer tous les E2E
```bash
pnpm exec playwright test
```

### Lancer un seul spec
```bash
pnpm exec playwright test e2e/hub-myads.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/hub-map.spec.ts --project=chromium --workers=1
```

### Lancer avec serveur Next auto
```bash
PW_WEB_SERVER=1 pnpm exec playwright test e2e/hub-myads.spec.ts e2e/hub-map.spec.ts --project=chromium --workers=1
```

### Mode strict Hub Map
```bash
E2E_STRICT_HUB_ADS=1 pnpm exec playwright test e2e/hub-map.spec.ts --project=chromium --workers=1 --retries=1
```

### Ouvrir le report
```bash
pnpm exec playwright show-report
```

### Traces
```bash
pnpm exec playwright show-trace test-results/**/trace.zip
```

---

<a id="contrat-paywall-rappel"></a>
## 🔒 Contrat Paywall

### Middleware
- Protège `GET /pro/:path*`
- Non authentifié → redirection 307 vers `/paywall`
- Header ajouté : `x-paywall: 1`

### API
- `POST /api/login`
- `POST /api/logout`
- `GET /api/health`

---

<a id="scripts-utiles"></a>
## 🛠️ Scripts utiles

```bash
pnpm dev
pnpm build && pnpm start
pnpm lint
pnpm tsc --noEmit
pnpm exec playwright test
pnpm exec playwright show-report
```

---

<a id="ci"></a>
## 🤖 CI

Workflows :
- CI – Lint & Typecheck
- E2E Playwright (artifacts + traces)

Recommandation : éviter `networkidle`, préférer `waitForRequest/Response`.

---

<a id="eslint-ignores-flat-config"></a>
## ESLint ignores

- `.next/`
- `node_modules/`
- `playwright-report/`
- `test-results/`

---

<a id="depannage"></a>
## 🧯 Dépannage

### Login E2E fail
```bash
PW_WEB_SERVER=1 pnpm exec playwright test e2e/hub-myads.spec.ts --project=chromium --workers=1
```

### Port déjà pris
```bash
lsof -i :3000 -sTCP:LISTEN
```

### Debug artifacts
```bash
find test-results -type f \( -iname "*failed*" -o -iname "*trace.zip" -o -iname "*video.webm" \)
```

---

<a id="roadmap-courte"></a>
## 🗺️ Roadmap

- Stabiliser pack E2E hub
- Renforcer CI (checks obligatoires)
- Ajouter specs smoke pages critiques
