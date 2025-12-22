// e2e/admin-verification-api.spec.ts
import { test, expect, request } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const HAS_SESSION_COOKIE = Boolean(process.env.E2E_SESSION_COOKIE && process.env.E2E_SESSION_COOKIE.includes('sid='))
const ADMIN_DOC_ID = (process.env.E2E_ADMIN_DOC_ID || '').trim()

test.describe('Admin verification API (smoke)', () => {
  test('PUT /api/admin/coach-documents/batch → 401 sans cookie', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL }) // pas de Cookie injecté
    const res = await ctx.put('/api/admin/coach-documents/batch', {
      data: { ids: ['x'], status: 'verified' },
    })
    expect(res.status()).toBe(401)
    await ctx.dispose()
  })

  test('Avec E2E_SESSION_COOKIE → ne doit pas répondre 401 (admin => 400, non-admin => 403)', async ({
    page,
  }) => {
    test.skip(!HAS_SESSION_COOKIE, 'Définis E2E_SESSION_COOKIE="sid=...; Path=/; Secure; SameSite=Lax"')

    // On envoie volontairement un body invalide pour éviter toute écriture en DB.
    // Si le cookie correspond à un admin, tu passes le guard et tu tombes sur la validation => 400.
    // Si c'est un user non-admin, tu bloques au guard => 403.
    const res = await page.request.put('/api/admin/coach-documents/batch', {
      data: { status: 'verified' }, // missing_ids
    })

    expect([400, 403]).toContain(res.status())

    if (res.status() === 403) {
      // Le test reste "OK" : ça prouve que le guard admin fonctionne.
      // Pour tester les updates, fournis un sid d'admin.
      const body = await res.json().catch(() => ({}))
      expect(body?.error).toBeDefined()
    }

    if (res.status() === 400) {
      const body = await res.json().catch(() => ({}))
      expect(body?.error).toBe('missing_ids')
    }
  })

  test('Optionnel: PUT /api/admin/coach-documents/[id] (nécessite sid admin + E2E_ADMIN_DOC_ID)', async ({
    page,
  }) => {
    test.skip(!HAS_SESSION_COOKIE, 'Définis E2E_SESSION_COOKIE (sid admin recommandé)')
    test.skip(!ADMIN_DOC_ID, 'Définis E2E_ADMIN_DOC_ID=<uuid coachDocument> pour un doc de test')

    // Probe: si pas admin -> skip proprement
    const probe = await page.request.put('/api/admin/coach-documents/batch', {
      data: { status: 'verified' }, // missing_ids
    })
    test.skip(probe.status() !== 400, 'Le cookie fourni ne correspond pas à un admin (403)')

    // 1) Update valide
    const ok = await page.request.put(`/api/admin/coach-documents/${ADMIN_DOC_ID}`, {
      data: { status: 'needs_review', review_note: 'e2e: needs review' },
    })
    expect(ok.status()).toBe(200)
    const okJson = await ok.json().catch(() => ({}))
    expect(okJson?.ok).toBe(true)

    // 2) Update invalide
    const bad = await page.request.put(`/api/admin/coach-documents/${ADMIN_DOC_ID}`, {
      data: { status: 'nope' },
    })
    expect(bad.status()).toBe(400)
    const badJson = await bad.json().catch(() => ({}))
    expect(badJson?.error).toBe('invalid_status')
  })
})
