import { test as base, expect, type Page, type TestInfo } from '@playwright/test'
import { dumpOnFail } from './utils/dump'
import { stubLeafletTiles } from './utils/leaflet'

type Fixtures = {
  // optionnel: on garde une trace de la dernière réponse API utile
  lastHubApi?: { url: string; status: number; body?: string }
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use, testInfo) => {
    // 1) État persistant: clean au démarrage (avant navigation)
    await page.addInitScript(() => {
      try { localStorage.clear() } catch {}
      try { sessionStorage.clear() } catch {}
    })

    // 2) Leaflet tiles: stub 1x1 PNG (évite "networkidle" / tiles cassées)
    await stubLeafletTiles(page)

    // 3) (optionnel) capturer la dernière réponse /api/hub/* pour debug
    const capture = process.env.E2E_CAPTURE_HUB_API === '1'
    let lastHubApi: Fixtures['lastHubApi'] = undefined
    if (capture) {
      page.on('response', async (res) => {
        const url = res.url()
        if (!url.includes('/api/hub/')) return
        try {
          const body = await res.text()
          lastHubApi = { url, status: res.status(), body }
        } catch {
          lastHubApi = { url, status: res.status() }
        }
      })
    }

    await use(page)

    if (capture && lastHubApi) {
      // stocké sur testInfo via attachments au moment du fail (cf afterEach)
      ;(testInfo as any)._lastHubApi = lastHubApi
    }
  }
})

export { expect }

// Dumps auto sur fail
test.afterEach(async ({ page }, testInfo) => {
  const failed = testInfo.status !== testInfo.expectedStatus
  if (!failed) return

  const lastHubApi = (testInfo as any)._lastHubApi as Fixtures['lastHubApi'] | undefined
  await dumpOnFail(page, testInfo, { lastHubApi })
})
