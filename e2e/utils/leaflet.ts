// e2e/utils/leaflet.ts
import type { Page } from "@playwright/test";

const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

export async function stubLeafletTiles(page: Page) {
  const body = Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64");

  // Stub uniquement les images des tiles (pas les XHR/fetch)
  await page.route(/openstreetmap\.org|tile\.openstreetmap\.org/i, async (route) => {
    const req = route.request();
    if (req.resourceType() !== "image") return route.continue();

    return route.fulfill({
      status: 200,
      body,
      contentType: "image/png",
      headers: { "cache-control": "public, max-age=3600" },
    });
  });
}
