// e2e/fixtures.ts
import { test as base, expect, type TestInfo } from "@playwright/test";
import { dumpOnFail, type LastHubApi } from "./utils/dump";
import { stubLeafletTiles } from "./utils/leaflet";

type Fixtures = {
  lastHubApi?: LastHubApi;
};

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    // 1) État persistant: clean au démarrage (avant navigation)
    await page.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {}
      try {
        sessionStorage.clear();
      } catch {}
    });

    // 2) Leaflet tiles: stub 1x1 PNG (évite "networkidle" / tiles cassées)
    await stubLeafletTiles(page);

    await use(page);
  },

  lastHubApi: async ({ page }, use) => {
    const capture = process.env.E2E_CAPTURE_HUB_API === "1";

    // ✅ On conserve 2 candidats : le dernier GET, et la dernière erreur (prioritaire)
    let lastGet: LastHubApi | undefined = undefined;
    let lastError: LastHubApi | undefined = undefined;

    if (capture) {
      page.on("response", async (res) => {
        const url = res.url();
        if (!url.includes("/api/hub/")) return;

        const req = res.request();
        const method = req.method();
        const status = res.status();

        // On ignore le bruit sauf:
        // - erreurs (>=400)
        // - GET (utile pour debug “last good call”)
        const isError = status >= 400;
        const isGet = method === "GET";
        if (!isError && !isGet) return;

        const record = async (): Promise<LastHubApi> => {
          try {
            const body = await res.text();
            return { url, status, body };
          } catch {
            return { url, status };
          }
        };

        if (isError) {
          lastError = await record();
          return;
        }

        // ici: GET non-erreur
        lastGet = await record();
      });
    }

    // ✅ On expose la valeur finale: dernière erreur si existante, sinon dernier GET
    await use(lastError ?? lastGet);
  },
});

export { expect };

// Dumps auto sur fail
test.afterEach(async ({ page, lastHubApi }, testInfo: TestInfo) => {
  const failed = testInfo.status !== testInfo.expectedStatus;
  if (!failed) return;

  await dumpOnFail(page, testInfo, { lastHubApi });
});