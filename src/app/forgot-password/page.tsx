// src/app/forgot-password/page.tsx
import { Suspense } from "react";
import ForgotPasswordClient from "./ForgotPasswordClient";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const email = typeof sp?.email === "string" ? sp.email : "";

  return (
    <Suspense fallback={null}>
      <ForgotPasswordClient initialEmail={email} />
    </Suspense>
  );
}
