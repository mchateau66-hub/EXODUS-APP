// src/app/forgot-password/ForgotPasswordClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

const STORAGE_KEY = "pwreset_email_v1";
const STORAGE_TTL_MS = 60 * 60 * 1000; // 1h

function normalizeEmail(s: string) {
  return (s || "").trim().toLowerCase();
}

function saveEmailForReset(email: string) {
  try {
    const payload = JSON.stringify({ email, exp: Date.now() + STORAGE_TTL_MS });
    localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // ignore
  }
}

function loadSavedEmail(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; exp?: number };
    if (!parsed?.email) return null;

    if (typeof parsed.exp === "number" && Date.now() > parsed.exp) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return String(parsed.email);
  } catch {
    return null;
  }
}

export default function ForgotPasswordClient({ initialEmail }: { initialEmail?: string }) {
  const initialEmailFromQuery = initialEmail ?? "";

  const [email, setEmail] = useState(initialEmailFromQuery);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDev = process.env.NODE_ENV === "development";

  // ✅ Préremplissage auto :
  // - priorité au query param ?email=
  // - sinon fallback localStorage (TTL)
  useEffect(() => {
    const q = normalizeEmail(initialEmailFromQuery);
    if (q) {
      setEmail(q);
      return;
    }

    setEmail((prev) => {
      const p = normalizeEmail(prev);
      if (p) return p;
      const saved = loadSavedEmail();
      return saved ? normalizeEmail(saved) : "";
    });
  }, [initialEmailFromQuery]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalized = normalizeEmail(email);
    if (normalized) saveEmailForReset(normalized);

    try {
      const res = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });

      const data = await res.json().catch(() => null);

      // anti-enumération : on affiche "ok" même si email inconnu
      setDone(true);

      // resetUrl uniquement en dev si exposée
      if (isDev && typeof data?.resetUrl === "string" && data.resetUrl.length > 0) {
        setResetUrl(data.resetUrl);
      } else {
        setResetUrl(null);
      }

      if (!res.ok && res.status === 429) {
        setError("Trop de tentatives. Réessaie dans quelques instants.");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8 space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">Mot de passe oublié</h1>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Si un compte existe pour cet email, vous recevrez un lien de réinitialisation.
            </p>

            {isDev && resetUrl && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                <div className="text-xs font-medium text-slate-700">Lien de reset (dev)</div>
                <code
                  data-testid="reset-url"
                  className="block text-xs break-all font-mono bg-white border border-slate-200 rounded-lg p-2"
                >
                  {resetUrl}
                </code>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(resetUrl)}
                    className="rounded-lg border px-3 py-1.5 text-xs hover:bg-white"
                  >
                    Copier
                  </button>
                  <a
                    href={resetUrl}
                    className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs hover:bg-slate-800"
                  >
                    Ouvrir
                  </a>
                </div>
              </div>
            )}

            <Link
              href="/login?next=/hub"
              className="block w-full text-center rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800"
            >
              Retour à la connexion
            </Link>

            <button
              type="button"
              onClick={() => {
                setDone(false);
                setResetUrl(null);
                setError(null);
              }}
              className="w-full rounded-xl border px-4 py-2.5 text-sm hover:bg-slate-50"
            >
              Renvoyer un lien
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-800">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Envoi…" : "Envoyer le lien"}
            </button>

            <Link href="/login?next=/hub" className="text-xs text-slate-600 hover:underline">
              Retour à la connexion
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
