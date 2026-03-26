# E2E — zone admin (`/admin/users`, etc.)

## Point d’entrée DX (local)

Pré-requis habituels : app joignable (`pnpm dev` ou équivalent), `DATABASE_URL`, `ALLOW_DEV_LOGIN=1`, `.env.local` / `.e2e.local.env` selon ton flux. Voir aussi la section **Variables utiles** ci-dessous.

Le seed Prisma (`pnpm db:seed`, `pnpm db:seed:e2e:admin`) charge **`.env`** puis **`.env.local`** (priorité à `.env.local`) pour que `DATABASE_URL` soit trouvé comme sous Next.js.

```bash
pnpm run e2e:admin
```

Équivalent explicite : `pnpm exec playwright test e2e/admin-users.spec.ts e2e/admin-verification.spec.ts --project=chromium --workers=1` (aligné sur l’étape CI **Run Playwright admin users E2E**). À utiliser après un changement sur les filtres admin, la vérification coach, le récap ou les specs, avant de pousser.

## Local vs CI (scénarios admin seedés)

| | **Local** | **CI** (`e2e-smoke-local`) |
|---|-----------|----------------------------|
| `DATABASE_URL` | Fichier `.env` / `.env.local` (voir ci-dessus) | Injecté par le workflow |
| `E2E_SEED_ADMIN_USERS_PAGINATION` | À exporter ou mettre dans `.e2e.local.env` pour **Playwright** ; le **seed** utilise `pnpm db:seed:e2e:admin` qui fixe `=1` | `1` dans le job |
| Ordre recommandé | `pnpm db:seed:e2e:admin` puis `E2E_SEED_ADMIN_USERS_PAGINATION=1 pnpm run e2e:admin`, ou **`pnpm e2e:admin:seeded`** (seed + tests en une commande) | Seed Prisma puis Playwright sur la même base |

Les tests **sans** jeu seed (filtres, SSR, etc.) passent avec `pnpm run e2e:admin` seul si l’app et le login dev sont OK.

## CI (pull request)

Le job **`e2e-smoke-local`** dans `.github/workflows/e2e.yml` enchaîne :

1. **`e2e/smoke.spec.ts`** — `E2E_SKIP_LOGIN=1` (aucun appel à `login()`).
2. **`e2e/admin-users.spec.ts`** — `E2E_SKIP_LOGIN=0`, `E2E_LOGIN_MAX_RETRIES=8`, même instance **Next** + **Postgres** que l’étape 1 (`ALLOW_DEV_LOGIN=1` au niveau du job).

`global-setup` reste en mode **sans storageState** (`E2E_DISABLE_STORAGE_STATE=1`) : le spec admin s’authentifie dans son `beforeEach`.

Ne pas fixer **`FEATURE_ADMIN_DASHBOARD=0`** sur ce job sans accepter que les tests admin soient **skip** (voir `admin-users.spec.ts`).

Les exécutions **smoke/full remote** (`workflow_dispatch`) ne lancent pas ce deuxième bloc sur PR ; le **full remote** shard exécute toute la suite Playwright (dont `admin-users.spec.ts`) si tu lances le mode `full` contre une preview avec `/api/login` utilisable.

## Variables utiles

| Variable | Rôle |
|----------|------|
| `E2E_BASE_URL` | Base de l’app (local: `http://127.0.0.1:3000` recommandé pour les cookies). |
| `ALLOW_DEV_LOGIN` | Doit permettre `POST /api/login` en local (`1` dans `.env.local`). |
| `DATABASE_URL` | Obligatoire pour que l’API login crée/ mette à jour l’utilisateur E2E. |
| `FEATURE_ADMIN_DASHBOARD` | Si `0`, le dashboard admin redirige : les specs admin sont **skip** (`admin-users.spec.ts`). |
| `E2E_SKIP_LOGIN` | Si `1`, interdit d’appeler `login()` — incompatible avec un storageState qui exige un login. |
| `E2E_DISABLE_STORAGE_STATE` | Si `1`, pas de `.pw/storageState.json` ; chaque spec doit s’authentifier seule. |
| `E2E_DEV_LOGIN_TOKEN` | Preview / remote : token pour `x-e2e-token` (voir `playwright.config`). |
| `E2E_SESSION_COOKIE` | Remote : injection cookie à la place du login HTTP. |
| `PW_WEB_SERVER` | Si `1` en local, Playwright lance `next dev` et attend `E2E_WEB_SERVER_READY_URL` (défaut `/api/health`). |
| `E2E_WEB_SERVER_READY_URL` | Surcharge de l’URL « prête » pour `webServer` (ex. `/api/health/ready`). |
| `E2E_LOGIN_MAX_RETRIES` | Nombre de tentatives sur `POST /api/login` en cas d’erreur réseau transitoire (défaut `5`, max `12`). |
| `E2E_SEED_ADMIN_USERS_PAGINATION` | Si `1`, les scénarios seed dans **`admin-users.spec.ts`** (liste → fiche + pagination) et **`admin-verification.spec.ts`** (vérification → fiche) **ne sont pas skip**. Le seed crée aussi un coach + document déterministes (`e2e-verification-coach@…`, slug `e2e-verification-coach`) — voir ci-dessous. |

## Fragilités connues (dev)

- **`ECONNRESET` sur `/api/login`** : le healthcheck peut être vert alors que Next compile encore la route API au premier appel. Les retries (`E2E_LOGIN_MAX_RETRIES`) et l’attente sur `/api/health` pour `webServer` réduisent le cas.
- **Serveur externe** : sans `PW_WEB_SERVER=1`, tu dois lancer toi-même `pnpm dev` sur le bon port **avant** `playwright test`.

## Lancer uniquement les tests admin users

Préférer `pnpm run e2e:admin` (voir ci-dessus). Commande brute équivalente :

```bash
pnpm exec playwright test e2e/admin-users.spec.ts e2e/admin-verification.spec.ts --project=chromium --workers=1
```

Le spec accepte aussi le texte « Filtres actifs : … » si un build sans `data-testid` tourne encore sur le port cible.

Les scénarios incluent un cas **SSR sans résultat** (`q` + `plan` volontairement impossible) pour verrouiller le message vide et le récap, sans soumettre le formulaire.

### Pagination (`page`)

- Paramètre de query **`page`** (entier ≥ 1) : `skip = (page - 1) ×` limite (voir `ADMIN_USER_SEARCH_TAKE` côté app).
- **Sans critères actifs** (`q`, filtres, etc.) : un `page` présent dans l’URL est **ignoré** — redirection vers `/admin/users` sans query.
- **Page hors plage** (ex. `page=999` alors qu’il n’y a aucun résultat ou une seule page) : **redirection canonique** vers la même recherche avec une page valide (souvent sans paramètre `page` quand la page effective est 1).
- Un scénario E2E couvre la redirection **sans dépendre** du nombre d’utilisateurs en base ; un test de navigation « page 2 » avec liste longue reste optionnel si les données locales dépassent la limite.

#### Jeu de données déterministe (pagination multi-page)

Pour que le test **« navigation page 1 → page 2 »** s’exécute (et ne soit pas **skip**), il faut :

1. **Seed Prisma** avec `E2E_SEED_ADMIN_USERS_PAGINATION=1` : crée **22** athlètes actifs dont l’e-mail contient `e2e-pagination` (`prisma/seed.e2e_admin_pagination.ts`, constante `E2E_ADMIN_PAGINATION_USER_COUNT`).
2. **Playwright** avec la même variable `E2E_SEED_ADMIN_USERS_PAGINATION=1` (déjà le cas dans le job CI **e2e-smoke-local**).

En local, **une** des options suivantes :

```bash
# Recommandé : seed déterministe admin + même variable pour Playwright
pnpm db:seed:e2e:admin
E2E_SEED_ADMIN_USERS_PAGINATION=1 pnpm run e2e:admin
```

Ou en une commande (même prérequis `DATABASE_URL` + app déjà prête pour les tests) :

```bash
pnpm e2e:admin:seeded
```

Ajoute `E2E_SEED_ADMIN_USERS_PAGINATION=1` dans `.e2e.local.env` si tu préfères ne pas préfixer chaque commande. Le scénario utilise `q=e2e-pagination` + `role=athlete` pour cibler uniquement ces lignes.

#### Liste → fiche utilisateur (`/admin/users/[id]`)

- Dans le même bloc **seed e2e** que la pagination (ordre d’exécution : **liste → fiche** d’abord, puis navigation page 1 → 2), un scénario ouvre la fiche **Usage et limites** via « Voir la fiche admin » après `q=e2e-pagination-00@exodus-e2e.local` + `role=athlete`. Assertions sur **Profil**, **Abonnement et billing**, **Usage** et **Entitlements effectifs** — mêmes prérequis `E2E_SEED_ADMIN_USERS_PAGINATION=1` que la pagination multi-page.

#### Vérification coachs → fiche (`/admin/verification` → `/admin/users/[id]`)

- Avec le même seed **`pnpm db:seed:e2e:admin`**, un coach **E2E Verification Coach** (`e2e-verification-coach@exodus-e2e.local`, slug `e2e-verification-coach`) et un **CoachDocument** `pending` sont créés. Le spec `e2e/admin-verification.spec.ts` ouvre `/admin/verification`, filtre la recherche sur le slug, clique **« Voir la fiche admin »**, puis vérifie **Usage et limites** et **Profil** sur la fiche utilisateur.
