// src/app/login/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type Plan = "free" | "master" | "premium";

export default function LoginPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const from = useMemo(() => {
    const next = sp.get("next") || sp.get("from") || "/";
    return next.startsWith("/") ? next : `/${next}`;
  }, [sp]);

  async function go(plan: Plan) {
    setError(null);
    setLoading(plan);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(text || `Login failed (${r.status})`);
      }

      router.replace(`/paywall?from=${encodeURIComponent(from)}`);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de connexion");
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-3 p-6">
      <h1 className="text-xl font-semibold">Connexion</h1>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        disabled={!!loading}
        onClick={() => go("free")}
        className="w-full rounded-2xl border px-4 py-2 disabled:opacity-50"
      >
        {loading === "free" ? "Connexion..." : "Continuer (Free)"}
      </button>

      <button
        disabled={!!loading}
        onClick={() => go("master")}
        className="w-full rounded-2xl bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading === "master" ? "Connexion..." : "Continuer (Master)"}
      </button>

      <button
        disabled={!!loading}
        onClick={() => go("premium")}
        className="w-full rounded-2xl bg-zinc-800 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading === "premium" ? "Connexion..." : "Continuer (Premium)"}
      </button>
    </div>
  );
}
