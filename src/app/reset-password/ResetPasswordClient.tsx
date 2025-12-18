"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type ApiErrCode =
  | "bad_request"
  | "weak_password"
  | "invalid_or_expired_token"
  | "too_many_requests"
  | "server_error"
  | string;

const STORAGE_KEY = "pwreset_email_v1";

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

function clearSavedEmail() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function extractErrorCode(data: any): ApiErrCode | null {
  // compatible avec plusieurs formats { error: "..." } / { code: "..." } / { errorCode: "..." }
  return (
    (typeof data?.error === "string" && data.error) ||
    (typeof data?.code === "string" && data.code) ||
    (typeof data?.errorCode === "string" && data.errorCode) ||
    null
  );
}

function humanMessage(code: ApiErrCode) {
  switch (code) {
    case "invalid_or_expired_token":
      return "Ce lien est invalide ou a expiré. Demande un nouveau lien pour réinitialiser ton mot de passe.";
    case "weak_password":
      return "Mot de passe trop faible. Utilise au moins 8 caractères (idéalement avec majuscules, minuscules et chiffres).";
    case "too_many_requests":
      return "Trop de tentatives. Réessaie dans quelques instants.";
    case "bad_request":
      return "Requête invalide. Vérifie le lien et réessaie.";
    case "server_error":
      return "Erreur serveur. Réessaie plus tard.";
    default:
      return "Une erreur est survenue. Réessaie.";
  }
}

export default function ResetPasswordClient() {
  const sp = useSearchParams();
  const token = useMemo(() => (sp.get("token") ?? "").trim(), [sp]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ApiErrCode | null>(null);

  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  useEffect(() => {
    setSavedEmail(loadSavedEmail());
  }, []);

  const forgotHref = savedEmail
    ? `/forgot-password?email=${encodeURIComponent(savedEmail)}`
    : "/forgot-password";

  const canSubmit =
    !!token && !loading && password.length >= 8 && confirm.length >= 8 && password === confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorCode(null);

    if (!token) {
      setErrorCode("invalid_or_expired_token");
      setError(humanMessage("invalid_or_expired_token"));
      return;
    }
    if (password.length < 8) {
      setErrorCode("weak_password");
      setError(humanMessage("weak_password"));
      return;
    }
    if (password !== confirm) {
      setErrorCode("bad_request");
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const code = extractErrorCode(data) || `http_${res.status}`;
        setErrorCode(code);
        setError(humanMessage(code));
        return;
      }

      // ✅ reset réussi -> on purge l’email stocké
      clearSavedEmail();
      setSuccess(true);
    } catch {
      setErrorCode("server_error");
      setError("Erreur réseau. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  // Si pas de token dans l’URL : UX directe
  if (!token && !success) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8 space-y-6">
          <h1 className="text-xl font-semibold text-slate-900">Réinitialiser le mot de passe</h1>

          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
            Lien manquant ou invalide. Redemande un nouveau lien de réinitialisation.
          </div>

          <Link
            href={forgotHref}
            className="block w-full text-center rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800"
          >
            Redemander un lien
          </Link>

          <Link href="/login?next=/hub" className="text-xs text-slate-600 hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8 space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">Réinitialiser le mot de passe</h1>

        {success ? (
          <div className="space-y-4">
            {/* ✅ garde ce texte pour ton E2E */}
            <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-900">
              Mot de passe mis à jour.
            </div>

            <Link
              href="/login?next=/hub"
              className="block w-full text-center rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800"
            >
              Se connecter
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-800">Nouveau mot de passe</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="text-xs text-slate-500">Minimum 8 caractères.</div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-800">Confirmer le mot de passe</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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

            {/* ✅ cas spécial : token invalide/expiré -> bouton redemander (prérempli si possible) */}
            {errorCode === "invalid_or_expired_token" && (
              <Link
                href={forgotHref}
                className="block w-full text-center rounded-xl border px-4 py-2.5 text-sm hover:bg-slate-50"
              >
                Redemander un lien
              </Link>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Mise à jour…" : "Mettre à jour"}
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
