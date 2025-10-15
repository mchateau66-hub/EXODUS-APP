import { test, expect } from '@playwright/test';

test('SAT one-time anti-replay', async ({ request }) => {
  const ent = await request.get('/api/entitlements?plan=premium');
  expect(ent.ok()).toBeTruthy();
  const { entitlements } = await ent.json();

  const satRes = await request.post('/api/sat', { headers: { authorization: `Bearer ${entitlements}` }});
  expect(satRes.ok()).toBeTruthy();
  const { sat } = await satRes.json();

  const r1 = await request.get('/api/premium', { headers: { 'x-sat': sat }});
  expect(r1.status()).toBe(200);

  const r2 = await request.get('/api/premium', { headers: { 'x-sat': sat }});
  expect(r2.status()).toBe(401);
});
