type PremiumRequest = { email: string };

function isPremiumRequest(x: unknown): x is PremiumRequest {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return typeof r.email === 'string';
}

// ...
const body: unknown = await req.json();
if (!isPremiumRequest(body)) {
  return NextResponse.json({ error: 'bad payload' }, { status: 400 });
}
// body.email est typé ici
