<!-- merge_gate_branch_protection_required_checks.md -->
# Merge Gate — Branch Protection (Required Checks)

But : empêcher les merges tant que les contrôles qualité/sécurité ne sont pas verts.

## Checks recommandés (Required)
Configurez ces contexts comme **Required status checks** sur `main` et `staging` :

- `Quality Gate / quality`
- `PR Guardian — Security Checklist / validate-template`
- `E2E Playwright / e2e`
- `Security Audit (Staging) / audit`

> Astuce : GitHub n’affiche un check “sélectionnable” qu’après l’avoir vu tourner au moins une fois sur une PR.

---

## Option A — Config manuelle (UI GitHub)
Settings → Branches → Branch protection rules :
- Require a pull request before merging ✅
- Require approvals (>= 1) ✅
- Dismiss stale approvals ✅
- Require status checks to pass ✅
- Require branches to be up to date ✅ (strict)

---

## Option B — Script (local)
Si vous avez un script interne, vous pouvez appliquer via API GitHub avec un token admin.

---

## Option C — Workflow “Enforce Branch Protection” (PAT admin)
Pré-requis : créer un token PAT admin (scope `repo`, `admin:repo_hook`) et le stocker en secret `GH_ADMIN_TOKEN`.

Workflow : `.github/workflows/enforce-branch-protection.yml`

Déclencher via Actions → Enforce Branch Protection → Run workflow.

---

## Dépannage
- Check name différent : le context est `"<workflow name> / <job id>"`.
- 401/403 : token non admin ou scopes insuffisants.
