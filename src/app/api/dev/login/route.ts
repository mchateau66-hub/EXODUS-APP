// src/app/api/dev/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export { GET, POST } from "../../e2e/login/route";
