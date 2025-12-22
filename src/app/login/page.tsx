// src/app/login/page.tsx
import { redirect } from "next/navigation";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[]; from?: string | string[] };
}) {
  const next =
    (typeof searchParams?.next === "string" && searchParams.next) ||
    (typeof searchParams?.from === "string" && searchParams.from) ||
    "/";

  const from = next.startsWith("/") ? next : `/${next}`;
  redirect(`/paywall?from=${encodeURIComponent(from)}`);
}
