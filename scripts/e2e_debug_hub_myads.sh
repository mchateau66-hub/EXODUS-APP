#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# E2E debug: login -> cookies -> hub -> détecte pourquoi "myads" n'apparait pas
# Usage:
#   bash scripts/e2e_debug_hub_myads.sh
#   BASE="http://127.0.0.1:3000" bash scripts/e2e_debug_hub_myads.sh
#   bash scripts/e2e_debug_hub_myads.sh "https://xxxxx.vercel.app"
# ============================================================

BASE="${1:-${BASE:-http://127.0.0.1:3000}}"
BASE="${BASE%/}"

# tmp dir portable mac
TMPDIR="$(mktemp -d 2>/dev/null || mktemp -d -t e2e_debug)"
HDR="$TMPDIR/headers.txt"
BODY="$TMPDIR/body.txt"
JAR="$TMPDIR/cookies.jar"
HUBHTML="$TMPDIR/hub.html"
HUBHDR="$TMPDIR/hub_headers.txt"

cleanup() { rm -rf "$TMPDIR" >/dev/null 2>&1 || true; }
trap cleanup EXIT

say() { printf "\n\033[1m%s\033[0m\n" "$*"; }
line() { printf "%s\n" "$*"; }

load_env_file() {
  local f="$1"
  if [[ -f "$f" ]]; then
    # shellcheck disable=SC1090
    set -a; . "$f"; set +a
    line "✅ loaded: $f"
  else
    line "ℹ️  not found: $f"
  fi
}

say "== 0) BASE =="
line "BASE=$BASE"

say "== 1) Load env (optional) =="
load_env_file ".e2e.local.env"
load_env_file ".env.local"

say "== 2) Env summary (redacted) =="
line "NODE_ENV=${NODE_ENV:-<unset>}"
line "ALLOW_DEV_LOGIN=${ALLOW_DEV_LOGIN:-<unset>}"
line "ALLOW_BROWSER_DEV_LOGIN=${ALLOW_BROWSER_DEV_LOGIN:-<unset>}"
line "E2E_DEV_LOGIN_TOKEN_SET=$([[ -n "${E2E_DEV_LOGIN_TOKEN:-}" ]] && echo yes || echo no)"
line "DATABASE_URL_SET=$([[ -n "${DATABASE_URL:-}" ]] && echo yes || echo no)"
line "DIRECT_URL_SET=$([[ -n "${DIRECT_URL:-}" ]] && echo yes || echo no)"

say "== 3) Basic reachability =="
set +e
curl -sS -D "$HDR" -o "$BODY" "$BASE/api/healthz" >/dev/null
RC=$?
set -e
if [[ $RC -ne 0 ]]; then
  line "❌ curl failed to reach $BASE (rc=$RC)"
  line "➡️  Vérifie BASE (localhost?) / URL Vercel Preview correcte."
  exit 2
fi

STATUS="$(grep -i '^HTTP/' "$HDR" | tail -n 1 | awk '{print $2}')"
line "GET /api/healthz => HTTP $STATUS"
if grep -qi "deployment_not_found" "$BODY"; then
  line "❌ Vercel: DEPLOYMENT_NOT_FOUND détecté"
  line "➡️  Ton BASE n'est pas une preview valide (copie la bonne URL depuis Vercel > Deployment > Domains)."
  exit 3
fi

say "== 4) Route /api/login exists? (GET should be 405 if only POST) =="
curl -sS -D "$HDR" -o /dev/null "$BASE/api/login" || true
STATUS="$(grep -i '^HTTP/' "$HDR" | tail -n 1 | awk '{print $2}')"
line "GET /api/login => HTTP $STATUS (405 = route OK, 404 = route introuvable)"

say "== 5) POST /api/login (E2E) =="
# headers
H1=(-H "content-type: application/json" -H "x-e2e: 1")
if [[ -n "${E2E_DEV_LOGIN_TOKEN:-}" ]]; then
  H1+=(-H "x-e2e-token: ${E2E_DEV_LOGIN_TOKEN}")
fi

# body
LOGIN_JSON='{"email":"e2e@local.test","plan":"free","role":"athlete"}'

# call
set +e
curl -sS -D "$HDR" -o "$BODY" -c "$JAR" -X POST "${H1[@]}" \
  --data "$LOGIN_JSON" \
  "$BASE/api/login"
RC=$?
set -e

STATUS="$(grep -i '^HTTP/' "$HDR" | tail -n 1 | awk '{print $2}')"
line "POST /api/login => HTTP $STATUS (rc=$RC)"
if grep -qi "deployment_not_found" "$BODY"; then
  line "❌ Vercel: DEPLOYMENT_NOT_FOUND sur /api/login"
  line "➡️  Ton BASE n'est pas une preview valide."
  exit 4
fi

line "--- response body (first 400 chars) ---"
head -c 400 "$BODY" || true
echo
line "--------------------------------------"

if [[ "$STATUS" != "200" ]]; then
  line "❌ Login failed. Regarde le body au-dessus."
  line "➡️  Causes typiques: token manquant/mauvais, ALLOW_DEV_LOGIN off, env pas chargée."
  exit 5
fi

if ! grep -q '"ok":true' "$BODY"; then
  line "❌ Login response does not contain ok:true"
  exit 6
fi

if [[ ! -s "$JAR" ]]; then
  line "❌ Cookie jar vide (aucun cookie reçu)"
  exit 7
fi

say "== 6) Cookies reçus =="
# cookie jar format: Netscape cookie file
# show cookie names for debug
awk 'BEGIN{FS="\t"} $0 !~ /^#/ && NF>=7 {print "cookie:", $6, "domain:", $1, "path:", $3}' "$JAR" | head -n 30 || true

say "== 7) DB user step sanity (optional endpoints) =="
# these endpoints may or may not exist; print status + short body
for url in \
  "$BASE/api/onboarding/status" \
  "$BASE/api/onboarding/step-3" \
  "$BASE/api/ads"
do
  set +e
  curl -sS -D "$HDR" -o "$BODY" -b "$JAR" "$url" >/dev/null
  RC=$?
  set -e
  STATUS="$(grep -i '^HTTP/' "$HDR" | tail -n 1 | awk '{print $2}')"
  line "$(printf "%-28s" "$(echo "$url" | sed "s|$BASE||")") => HTTP $STATUS (rc=$RC)"
  head -c 260 "$BODY" | tr '\n' ' ' | sed 's/  */ /g' || true
  echo
done

say "== 8) Fetch /hub (HTML) with cookies, follow redirects =="
set +e
curl -sS -L -D "$HUBHDR" -o "$HUBHTML" -b "$JAR" "$BASE/hub"
RC=$?
set -e

STATUS="$(grep -i '^HTTP/' "$HUBHDR" | tail -n 1 | awk '{print $2}')"
line "GET /hub (follow redirects) => HTTP $STATUS (rc=$RC)"
if grep -qi "deployment_not_found" "$HUBHTML"; then
  line "❌ Vercel: DEPLOYMENT_NOT_FOUND sur /hub"
  exit 8
fi

say "== 9) Detect what page we landed on =="
FOUND_MYADS=0
FOUND_ONBOARD=0
FOUND_LOGIN=0

grep -qi 'data-testid="myads"' "$HUBHTML" && FOUND_MYADS=1 || true
grep -qi 'Parle-nous' "$HUBHTML" && FOUND_ONBOARD=1 || true
grep -qi 'data-testid="login"|/api/login|Se connecter|Connexion' "$HUBHTML" && FOUND_LOGIN=1 || true

line "myads marker:      $([[ $FOUND_MYADS -eq 1 ]] && echo YES || echo NO)"
line "onboarding marker: $([[ $FOUND_ONBOARD -eq 1 ]] && echo YES || echo NO)"
line "login marker:      $([[ $FOUND_LOGIN -eq 1 ]] && echo YES || echo NO)"

say "== 10) Show nearby markers (if any) =="
if [[ $FOUND_MYADS -eq 1 ]]; then
  line "--- snippet around data-testid=\"myads\" ---"
  grep -n 'data-testid="myads"' "$HUBHTML" | head -n 3 || true
fi

if [[ $FOUND_ONBOARD -eq 1 ]]; then
  line "--- snippet around \"Parle-nous\" ---"
  grep -n 'Parle-nous' "$HUBHTML" | head -n 3 || true
fi

if [[ $FOUND_MYADS -eq 0 ]]; then
  say "== 11) Quick conclusion =="
  if [[ $FOUND_ONBOARD -eq 1 ]]; then
    line "➡️  Tu arrives sur l'onboarding, donc /hub ne te considère pas \"prêt\"."
    line "   Probables causes:"
    line "   - le cookie de session n'est pas lu côté pages /hub (cookie name mismatch)"
    line "   - /hub check autre chose que onboardingStep (ex: athleteProfile manquant)"
    line "   - en Playwright: cookies login pas injectés dans le navigateur (request != page.request)"
  elif [[ $FOUND_LOGIN -eq 1 ]]; then
    line "➡️  Tu n'es pas authentifié côté /hub (cookies pas appliqués)."
  else
    line "➡️  /hub renvoie autre chose (regarde le HTML)."
  fi
fi

say "== 12) Files saved (for inspection) =="
line "Cookies : $JAR"
line "Hub HTML : $HUBHTML"
line "Hub headers : $HUBHDR"

say "== DONE =="
