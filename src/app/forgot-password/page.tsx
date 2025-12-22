// src/app/forgot-password/page.tsx
import { Suspense } from "react";
import ForgotPasswordClient from "./ForgotPasswordClient";

export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams?: { email?: string };
}) {
  const email = typeof searchParams?.email === "string" ? searchParams.email : "";

  return (
    <Suspense fallback={null}>
      <ForgotPasswordClient initialEmail={email} />
    </Suspense>
  );
}
