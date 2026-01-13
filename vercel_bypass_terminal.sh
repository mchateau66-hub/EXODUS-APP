#!/usr/bin/env bash
set -euo pipefail

need(){ command -v "$1" >/dev/null || { echo "❌ commande manquante: $1"; exit 1; }; }
need node
need openssl
need curl
need pbpaste
need pbcopy

test -f .vercel/project.json || { echo "❌ .vercel/project.json introuvable. Fais: vercel link"; exit 1; }

PROJECT_ID="$(node -p "require('./.vercel/project.json').projectId")"
TEAM_ID="$(node -p "require('./.vercel/project.json').orgId")"
echo "✅ PROJECT_ID=$PROJECT_ID"
echo "✅ TEAM_ID=$TEAM_ID"

echo ""
echo "➡️  1) Copie MAINTENANT ton Vercel PAT (valeur seule) dans Vercel"
echo "➡️  2) Reviens ici et appuie sur Entrée (je lis le presse-papier)"
read -r </dev/tty

VERCEL_PAT="$(pbpaste | tr -d $'\r\n')"
if [[ -z "$VERCEL_PAT" ]]; then
  echo "❌ Presse-papier vide. Re-copie le PAT puis relance."
  exit 1
fi

# ✅ URL correcte (le bug 'host: com' vient d’une URL tronquée)
API="https://api.vercel.com"

CODE="$(curl -sS -o /dev/null -w "%{http_code}" \
  -H "AuthorizT" \
  "$API/v2/user")"
echo "ℹ️ PAeck => HTTP $CODE"
[[ "$CODE" == "200" ]] || { echo "❌ PAT refusé. Recrée un token si besoin."; exit 1; }
echo "✅ PAT OK"

# Génère un bypass local (64 hex)
BYPASS="$(openssl rand -hex 32)"
FP="$(printf %s "$BYPASS" | shasum -a 25-c1-8)"

# 1) Essai: demander à Vercel de créer/générer le bypass avec une valeur fournie
# (si Vercel refuse ce format, on tombera sur un fallback)
BODY1="$(printf '{"generate":{"secret":"%s"}}' "$BYPASS")"
HTTP1="$(curl -sS -o /tmp/vercel_bypass.json -w "%{http_code}" -X PATCH \
  -H "Authorization: Bearer $VERCEL_PAT" \
  -H "Content-Type: application/json" \
  --data "$BODY1" \
  "$API/v1/projects/$PROJECT_ID/protection-by?teamId=$TEAM_ID")"
echo "ℹ️ PATCH(generate+secret) => HTTP $HTTP1"

if [[ "$HTTP1" != "200" ]]; then
  # 2) Fallback: laisser Vercel générer (la réponse peut contenir le secret)
  HTTP2="$(curl -sS -o /tmp/vercel_bypass.json -w "%{http_code}" -X PATCH \
    -H "Authorization: Bearer $VERCEL_PAT" \
    -H "Content-Type: application/json" \
    --data '{"generate":{}}' \
    "$API/v1/projects/$PROJECT_ID/protection-bypass?teamId=$TEAM_ID")"
  echo "ℹ️ PATCH(generate) => HTTP $HTTP2"
  [[ "$HTTP2" == "200" ]] || { echo "❌ Échec PATCH. Réponse:cel_bypass.json; exit 1; }

  # Essaye d’extraire un secret depuis la réponse
  EXTRACTED="$(
    node - <<'NODE'
const fs = require("fs");
const txt = fs.readFileSync("/tmp/vercel_bypass.json","utf8");
let j; try { j = JSON.parse(txt); } catch { process.exit(0); }

const direct = [
  j?.protectionBypass?.secret,
  j?.protectionBypass?.token,
  j?.secret,
  j?.token,
].find(v => typeof v === "string" && v.length >= 16);

if (direct) { process.stdout.write(direct); process.exit(0); }

// deep search for something that looks like a token (hex64 or vercel_*)
const stack=[j];
while(stack.length){
  const cur=stack.pop();
  if(!cur || typeof cur!=="object") continue;
  for(const k of Object.keys(cur)){
    const v=cur[k];
    if(typeof v==="string"){
      if(/^[a-f0-9]{64}$/i.test(v) || /^vercel_/i.test(v)) {
        process.stdout.write(v); process.exit(0);
      }
    } else if(v && typeof v==="object") stack.push(v);
  }
}
NODE
  )"

  if [[ "$EXTRACTED" ]]; then
    BYPASS="$EXTRACTED"
    FP="$(printf %s "$BYPASS" | shasum -a 256 | cut -c1-8)"
  else
    echo "⚠️ Vercel a généré un bypass mais la réponse ne contient pas le secret."
    echo "   Ouvre /tmp/vercel_bypass.json pour voir ce qui est renvoyé :"
    echo "   cat /tmp/vercel_bypass.json"
    exit 1
  fi
fi

# Sauvegarde + presse-papier
printf %s "$BYPASS" > .vercel_bypass_secret
chmod 600 .vercel_bypass_secret
printf %s "$BYPASS" | pbcopy

echo "✅ BYPASS OK (fp=$FP) — copié dans le presse-papier + écrit dans .vercel_bypass_secret"
