import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPrefix: process.env.DATABASE_URL?.slice(0, 35) ?? null, // pas l’URL entière
    nodeEnv: process.env.NODE_ENV,
  });
}