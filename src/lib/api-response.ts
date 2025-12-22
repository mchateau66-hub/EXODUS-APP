export const NO_STORE = { "cache-control": "no-store" } as const;

type Json = Record<string, unknown>;
type Init = Omit<ResponseInit, "headers"> & { headers?: HeadersInit };

function mergeHeaders(...hs: (HeadersInit | undefined)[]) {
  const h = new Headers();
  for (const item of hs) {
    if (!item) continue;
    new Headers(item).forEach((v, k) => h.set(k, v));
  }
  return h;
}

export function ok(body: Json = {}, init: Init = {}) {
  return Response.json(
    { ok: true, ...body },
    { status: 200, ...init, headers: mergeHeaders(NO_STORE, init.headers) }
  );
}

export function err(error: string, status = 400, body: Json = {}, init: Init = {}) {
  return Response.json(
    { ok: false, error, ...body },
    { status, ...init, headers: mergeHeaders(NO_STORE, init.headers) }
  );
}
