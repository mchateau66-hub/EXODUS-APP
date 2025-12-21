// e2e/coach-verification.spec.ts
import { test, expect, type Page } from "@playwright/test";
import { BASE_URL, waitForHealth, login, setSessionCookieFromEnv } from "./helpers";

const MESSAGES_PATH = "/api/messages";
const SAT_FEATURE = (process.env.E2E_SAT_FEATURE?.trim() || "chat.media") as string;

const HAS_SESSION_COOKIE = Boolean(process.env.E2E_SESSION_COOKIE?.trim());
const HAS_SAT_SECRET = Boolean(process.env.SAT_JWT_SECRET?.trim());

// Optionnel : force un coach précis (recommandé en CI)
const FIXED_UNVERIFIED_COACH_SLUG = (process.env.E2E_UNVERIFIED_COACH_SLUG?.trim() || "") as string;

async function ensureAuth(page: Page, plan: "free" | "master" | "premium" = "premium") {
  if (HAS_SESSION_COOKIE) return;
  await login(page, { plan });
}

async function acquireSatForMessages(page: Page) {
  const r = await page.request.post("/api/sat", {
    headers: { origin: BASE_URL },
    data: { feature: SAT_FEATURE, method: "POST", path: MESSAGES_PATH },
  });
  const body = (await r.json().catch(() => ({}))) as any;
  return { status: r.status(), body };
}

function extractCoachSlugsFromHtml(html: string): string[] {
  // match href="/coachs/<slug>" (ou URL absolue)
  const out = new Set<string>();

  const re = /\/coachs\/([a-z0-9-]{2,})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const slug = String(m[1] || "").toLowerCase().trim();
    if (slug) out.add(slug);
  }

  return Array.from(out);
}

async function discoverCandidateCoachSlugs(page: Page): Promise<string[]> {
  if (FIXED_UNVERIFIED_COACH_SLUG) return [FIXED_UNVERIFIED_COACH_SLUG.toLowerCase()];

  // On tente de récupérer une liste de coachs depuis /coachs (directory public)
  const res = await page.request.get("/coachs", { headers: { origin: BASE_URL } });
  if (!res.ok()) return [];

  const html = await res.text();
  return extractCoachSlugsFromHtml(html);
}

test.describe("Coach verification gate (POST /api/messages)", () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? "/api/health", 20_000);
  });

  test.beforeEach(async ({ context }) => {
    await setSessionCookieFromEnv(context);
  });

  test("Athlete → coach non vérifié => 403 coach_not_verified", async ({ page }) => {
    test.skip(!HAS_SAT_SECRET, "SAT_JWT_SECRET manquant: SAT non enforce (skip)");

    await ensureAuth(page, "premium");

    const slugs = await discoverCandidateCoachSlugs(page);

    // Si rien trouvé et pas de slug forcé => on skip proprement
    test.skip(
      slugs.length === 0,
      "Aucun coach slug détecté sur /coachs. Définis E2E_UNVERIFIED_COACH_SLUG pour rendre le test déterministe.",
    );

    let found = false;
    let tried = 0;

    // On limite les tentatives pour éviter rate-limit /api/sat
    for (const coachSlug of slugs.slice(0, 8)) {
      tried++;

      // SAT frais (anti-replay)
      const { status: satStatus, body: satBody } = await acquireSatForMessages(page);
      if (satStatus !== 200 || !satBody?.token) {
        // Si le rate-limit SAT tape, on ne fait pas échouer ce test sans contexte
        // (ça sera attrapé par ratelimit.spec.ts)
        continue;
      }

      const r = await page.request.fetch(MESSAGES_PATH, {
        method: "POST",
        headers: {
          origin: BASE_URL,
          "content-type": "application/json",
          "x-sat": String(satBody.token),
        },
        data: {
          coachId: coachSlug,
          content: "test verification gate",
        },
      });

      // Cas attendu : coach existe MAIS non vérifié => 403 coach_not_verified
      if (r.status() === 403) {
        const json = (await r.json().catch(() => ({}))) as any;
        if (json?.ok === false && json?.error === "coach_not_verified") {
          found = true;
          break;
        }
      }

      // Si coach pas trouvé (404), on ignore et on essaie un autre slug
      // Si 200 => coach vérifié, on essaie un autre
    }

    expect(
      found,
      `Impossible de trouver un coach non vérifié après ${tried} tentative(s). ` +
        `Astuce: définis E2E_UNVERIFIED_COACH_SLUG vers un coach non vérifié en CI.`,
    ).toBeTruthy();
  });
});
