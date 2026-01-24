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
- **API logout** : `POST /api/logout` → `204 No Content` (invalide la session)
- **Middleware paywall** : protège **`/pro/:path*`**
  - passe si **cookie `session`** ou **`Authorization: Bearer <token>`**
  - sinon → **`307`** vers **`/paywall?paywall=1&from=<path>`** + header **`x-paywall: 1`**

> La page `/paywall` expose `data-testid="paywall"` pour les E2E.

---

<a id="demarrer-en-local"></a>
## 🏁 Démarrer en local

```bash
pnpm i

# (recommandé) installe les navigateurs Playwright si tu fais des E2E
pnpm exec playwright install --with-deps

# utiliser un port libre pour éviter les surprises
PORT=3005 pnpm dev
# ➜ Ready on http://localhost:3005
```

---

<a id="tests-e2e-playwright"></a>
## 🧪 Tests E2E (Playwright)

> Objectif : enchaîner les validations sans flaky (run “1 spec = 1 objectif”, `--workers=1`, attente réseau corrélée, dumps auto sur fail).

### Nettoyer avant un run
```bash
rm -rf test-results playwright-report
```

### Lancer tous les E2E
```bash
pnpm exec playwright test
```

### Lancer un seul spec (recommandé pour debug / anti-flaky)
```bash
pnpm exec playwright test e2e/hub-myads.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/hub-map.spec.ts  --project=chromium --workers=1
```

### Lancer avec serveur Next automatiquement (local)
Dans `playwright.config.ts`, le `webServer` n’est démarré **que si** `PW_WEB_SERVER=1`.
```bash
rm -rf test-results playwright-report && \
PW_WEB_SERVER=1 pnpm exec playwright test e2e/hub-myads.spec.ts e2e/hub-map.spec.ts --project=chromium --workers=1
```

### Anti-flaky : répéter 10 fois (stabilité)
```bash
pnpm exec playwright test e2e/hub-myads.spec.ts --project=chromium --workers=1 --repeat-each=10
```

### Mode strict (Hub Map)
Par défaut, le test map est **smoke** (non-bloquant si `/api/hub/ads` n’est pas observé, ex: couche athlète placeholder).  
Pour rendre l’assert réseau **obligatoire** :
```bash
E2E_STRICT_HUB_ADS=1 pnpm exec playwright test e2e/hub-map.spec.ts --project=chromium --workers=1 --retries=1
```

### Ouvrir le report HTML
```bash
pnpm exec playwright show-report
```

### Traces / Vidéos / Screenshots
La config Playwright est déjà réglée pour :
- `trace: on-first-retry`
- `video: retain-on-failure`
- `screenshot: only-on-failure`

Artifacts (local & CI) :
- `test-results/**/trace.zip`
- `test-results/**/video.webm`
- `test-results/**/failed-*.{txt,html,png}`

Ouvrir une trace :
```bash
pnpm exec playwright show-trace test-results/**/trace.zip
```

### Variables d’environnement utiles
- `E2E_BASE_URL=http://127.0.0.1:3005` : cible l’URL de l’app (local/remote)
- `PW_WEB_SERVER=1` : démarre Next automatiquement via Playwright (local)
- `E2E_DISABLE_STORAGE_STATE=1` : désactive `storageState` si tu veux éviter toute pollution de session
- `E2E_STRICT_HUB_ADS=1` : rend le test hub-map strict sur `/api/hub/ads`

---

<a id="contrat-paywall-rappel"></a>
## 🔒 Contrat Paywall (rappel)

### Middleware
- Protège `GET /pro/:path*`
- Si **non authentifié** :
  - redirige `307` → `/paywall?paywall=1&from=<path>`
  - ajoute `x-paywall: 1`
- Si authentifié :
  - laisse passer (cookie `session` ou header `Authorization: Bearer <token>`)

### API
- `POST /api/login`
  - pose `Set-Cookie: session=...`
  - body optionnel : `{"maxAge": 600}`
- `POST /api/logout`
  - renvoie `204` et invalide la session
- `GET /api/health`
  - renvoie `200`

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
pnpm exec playwright show-report
```

---

<a id="ci"></a>
## 🤖 CI

Workflows principaux :
- **CI – Lint & Typecheck** : lint + TS
- **E2E Playwright** : lance les tests Playwright + upload du report HTML + traces (artifacts)

Recommandations :
- Garder les E2E **déterministes** : pas de `networkidle`, préférer `waitForRequest/Response` corrélés.
- En CI : privilégier `--workers` contrôlé + `retries` (déjà géré dans la config).

---

<a id="eslint-ignores-flat-config"></a>
## ESLint ignores (flat config)

À ignorer (au minimum) :
- `.next/`
- `node_modules/`
- `playwright-report/`
- `test-results/`

---

<a id="depannage"></a>
## 🧯 Dépannage

### 1) Login E2E fail / 404 sur `/api/login`
- Assure-toi que **le bon serveur** tourne sur le bon port
- Si tu ne veux pas lancer Next à la main : utilise `PW_WEB_SERVER=1`

```bash
PW_WEB_SERVER=1 pnpm exec playwright test e2e/hub-myads.spec.ts --project=chromium --workers=1
```

### 2) Port déjà pris
```bash
lsof -i :3000 -sTCP:LISTEN
```

### 3) Leaflet / tiles qui cassent la page
Les specs hub stubbent les tiles OSM (1x1 PNG) via `e2e/utils/leaflet.ts` pour éviter le flaky.

### 4) Où trouver les attachments/debug
```bash
find test-results -type f \( -iname "*failed*" -o -iname "*trace.zip" -o -iname "*video.webm" -o -iname "step-*" \)
```

---

<a id="roadmap-courte"></a>
## 🗺️ Roadmap (courte)

- Stabiliser le pack E2E hub (map + mes annonces) + garder la base util (`e2e/utils/*`)
- Renforcer la CI : checks obligatoires + artifacts (report + traces)
- Ajouter des specs “smoke” par page critique (login, hub, paywall, pro/…)

