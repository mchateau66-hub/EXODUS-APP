import { test, expect } from "@playwright/test";

// --- Existing health/home smoke config ---
const envPath = (process.env.E2E_SMOKE_PATH || "").trim();
const preferred = envPath || "/api/health/ready";

const apiCandidates = Array.from(
  new Set([
    preferred,
    "/api/health/ready",
    "/api/health",
    "/api/healthz",
    "/api/status",
  ]),
).map((p) => (p.startsWith("/") ? p : `/${p}`));

// --- New: monetization/security smoke config (env-driven) ---
const PREMIUM_ENDPOINT = (process.env.E2E_PREMIUM_ENDPOINT || "").trim(); // e.g. "/api/premium/me" or "/api/chat"
const SAT_MINT_ENDPOINT = (process.env.E2E_SAT_MINT_ENDPOINT || "").trim(); // optional: endpoint that returns a SAT token (dev-only)
const SAT_HEADER_NAME = (process.env.E2E_SAT_HEADER_NAME || "authorization").trim(); // "authorization" or "x-sat"
const SAT_HEADER_PREFIX = (process.env.E2E_SAT_HEADER_PREFIX || "Bearer ").trim(); // if using Authorization: Bearer <sat>
const STRIPE_WEBHOOK_PATH = (process.env.E2E_STRIPE_WEBHOOK_PATH || "/api/stripe/webhook").trim();

// Optional secrets for webhook simulation (only needed if you want to actually hit webhook route in smoke-local)
const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();

// Helper: treat "expected blocked" statuses as success
function isBlockedStatus(status: number) {
  // depending on your app conventions:
  // 401 unauth, 403 forbidden, 402 payment required, 429 rate limit
  return status === 401 || status === 403 || status === 402 || status === 429;
}

test("@smoke app or health endpoint responds 2xx and homepage loads", async ({ page, request }) => {
  let ok = false;
  let last = "";

  // 1) Health/API: 2xx obligatoire
  for (const p of apiCandidates) {
    const r = await request.get(p, { timeout: 15_000 }).catch(() => null);
    const status = r?.status() ?? 0;
    last = `API ${p} status=${status}`;
    if (status >= 200 && status < 300) {
      ok = true;
      break;
    }
  }

  expect(ok, `Health failed. Tried=${apiCandidates.join(", ")} last=${last}`).toBe(true);

  // 2) Homepage: charge + DOM visible (3xx ok si redirect)
  const res = await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });
  expect(res, "homepage navigation returned null response").toBeTruthy();

  const st = res!.status();
  expect(st, `homepage status should be < 400, got ${st}`).toBeLessThan(400);

  await expect(page.locator("body")).toBeVisible();
});

test("@smoke premium endpoint is blocked without SAT (no bypass)", async ({ request }) => {
  test.skip(!PREMIUM_ENDPOINT, "E2E_PREMIUM_ENDPOINT not set");

  const endpoint = PREMIUM_ENDPOINT.startsWith("/") ? PREMIUM_ENDPOINT : `/${PREMIUM_ENDPOINT}`;

  // No auth headers, should NOT be 200
  const r = await request.get(endpoint, { timeout: 15_000 }).catch(() => null);
  const status = r?.status() ?? 0;

  // If endpoint doesn't exist in this env, fail loudly (helps keep config correct)
  expect(status, `[premium] ${endpoint} returned 404 - check E2E_PREMIUM_ENDPOINT`).not.toBe(404);

  // Expected: blocked (401/403/402/429), or at minimum not 2xx
  expect(
    status < 200 || status >= 300 || isBlockedStatus(status),
    `[premium] should be blocked without SAT. Got status=${status} for ${endpoint}`,
  ).toBe(true);
});

test("@smoke SAT anti-replay (second use must be rejected)", async ({ request }) => {
  test.skip(!SAT_MINT_ENDPOINT || !PREMIUM_ENDPOINT, "E2E_SAT_MINT_ENDPOINT / E2E_PREMIUM_ENDPOINT not set");

  const mint = SAT_MINT_ENDPOINT.startsWith("/") ? SAT_MINT_ENDPOINT : `/${SAT_MINT_ENDPOINT}`;
  const endpoint = PREMIUM_ENDPOINT.startsWith("/") ? PREMIUM_ENDPOINT : `/${PREMIUM_ENDPOINT}`;

  // 1) Mint a SAT (dev-only endpoint) – expected 200 + { token } or plain text token
  const mintRes = await request.post(mint, { timeout: 15_000 }).catch(() => null);
  const mintStatus = mintRes?.status() ?? 0;
  expect(mintStatus, `[sat] mint endpoint failed: ${mint} status=${mintStatus}`).toBeGreaterThanOrEqual(200);
  expect(mintStatus).toBeLessThan(300);

  const bodyText = await mintRes!.text();
  let sat = "";
  try {
    const json = JSON.parse(bodyText);
    sat = (json.token || json.sat || json.jwt || "").toString();
  } catch {
    sat = bodyText.trim();
  }

  expect(sat, `[sat] mint endpoint did not return a token. body=${bodyText}`).toBeTruthy();

  const headers: Record<string, string> = {};
  if (SAT_HEADER_NAME.toLowerCase() === "authorization") {
    headers["authorization"] = `${SAT_HEADER_PREFIX}${sat}`;
  } else {
    headers[SAT_HEADER_NAME] = sat;
  }

  // 2) First call should be allowed (typically 200/2xx)
  const r1 = await request.get(endpoint, { headers, timeout: 15_000 }).catch(() => null);
  const s1 = r1?.status() ?? 0;
  expect(s1, `[sat] first use should succeed. status=${s1}`).toBeGreaterThanOrEqual(200);
  expect(s1).toBeLessThan(300);

  // 3) Second call with same token must be rejected (anti-replay)
  const r2 = await request.get(endpoint, { headers, timeout: 15_000 }).catch(() => null);
  const s2 = r2?.status() ?? 0;

  expect(
    isBlockedStatus(s2) || s2 === 400,
    `[sat] second use should be rejected (anti-replay). got status=${s2}`,
  ).toBe(true);
});

test("@smoke Stripe webhook idempotence (same event twice -> ok)", async ({ request }) => {
  // Only run locally when you have STRIPE_WEBHOOK_SECRET set in env,
  // otherwise webhook signature will fail (as expected).
  test.skip(!STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET not set");

  const path = STRIPE_WEBHOOK_PATH.startsWith("/") ? STRIPE_WEBHOOK_PATH : `/${STRIPE_WEBHOOK_PATH}`;

  // Minimal Stripe-like event payload (type can be anything your handler accepts, but signature must match)
  const now = Math.floor(Date.now() / 1000);
  const eventId = `evt_e2e_${now}`;

  const payload = JSON.stringify({
    id: eventId,
    object: "event",
    api_version: "2024-06-20",
    created: now,
    livemode: false,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: `sub_e2e_${now}`,
        object: "subscription",
        status: "active",
        customer: `cus_e2e_${now}`,
        cancel_at_period_end: false,
        current_period_start: now,
        current_period_end: now + 3600,
        items: {
          data: [
            {
              price: {
                id: `price_e2e_${now}`,
                recurring: { interval: "month" },
              },
            },
          ],
        },
        metadata: {
          planKey: "test",
          billingPeriod: "monthly",
        },
      },
    },
  });

  // We need to sign the payload like Stripe.
  // If you already have a helper for this in repo, use it; otherwise keep this simple:
  // Stripe signature scheme uses HMAC SHA256 over `${timestamp}.${payload}`.
  const crypto = await import("node:crypto");
  const timestamp = now.toString();
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(signedPayload).digest("hex");
  const sigHeader = `t=${timestamp},v1=${signature}`;

  const headers = {
    "stripe-signature": sigHeader,
    "content-type": "application/json",
  };

  // First delivery
  const r1 = await request.post(path, { data: payload, headers, timeout: 20_000 }).catch(() => null);
  const s1 = r1?.status() ?? 0;
  expect(s1, `[webhook] first delivery failed status=${s1}`).toBe(200);

  // Second delivery (same event id) should still be 200 (idempotence)
  const r2 = await request.post(path, { data: payload, headers, timeout: 20_000 }).catch(() => null);
  const s2 = r2?.status() ?? 0;
  expect(s2, `[webhook] second delivery should be ok (idempotent). status=${s2}`).toBe(200);
});
