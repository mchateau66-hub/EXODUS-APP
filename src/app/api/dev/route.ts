// src/app/api/dev/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ✅ /api/dev => même handler que /api/dev/grant-messages-unlimited
export { POST } from "./grant-messages-unlimited/route";

// Optionnel : si tu veux aussi supporter GET (sinon 404)
export async function GET() {
  return new Response("Not found", { status: 404 });
}
