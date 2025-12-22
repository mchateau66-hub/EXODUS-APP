## Résumé
<!-- Décris en 2-3 lignes ce que fait ce PR -->
- 

## Pourquoi ?
<!-- Contexte / ticket / bug / besoin -->
- 

## Changements principaux
- 
- 
- 

## Comment tester
- [ ] Localement
- [ ] Preview Vercel
- [ ] E2E (smoke) sur PR
- [ ] E2E (full) via workflow_dispatch si nécessaire

## Impact / Risques
- Impact utilisateur : 
- Risque rollback : 
- Migration / seed / data : 

---

## ✅ Security Checklist (OBLIGATOIRE — coche les cases)
> Le CI échoue si tu ne coches pas ces items.

- [ ] **Monetisation** — paywall/plan gating/pricing vérifiés
- [ ] **Entitlements** — rôles/permissions/accès vérifiés (deny-by-default si applicable)
- [ ] **Stripe** — webhooks/keys/signature/idempotency vérifiés (si concerné)
- [ ] **CSP** (Content Security Policy) — en-têtes CSP vérifiés / pas de régression
- [ ] **RateLimit** (rate limit / ratelimit) — protections anti-abus vérifiées
- [ ] **Health** / readiness — endpoint(s) health/ready opérationnels
- [ ] **PII-Guard** — aucun email/tel/PII en clair dans payloads/logs/traces
- [ ] **E2E** — tests E2E ajoutés/ajustés et passants (smoke au minimum)
- [ ] **Security audit** — revue rapide des surfaces (auth, input, SSRF, secrets) effectuée

---

## Notes de déploiement
- Variables / secrets à ajouter :
- Étapes spécifiques (migrations, cron, queues) :
- Rollback :
