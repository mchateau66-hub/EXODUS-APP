// src/app/(public)/signup/page.tsx
"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

type RoleChoice = "athlete" | "coach"
type PlanChoice = "free" | "premium"

type SignupResponse = {
  ok: boolean
  error?: string
  redirectTo?: string
  checkoutUrl?: string
}

function isRoleChoice(v: string | null): v is RoleChoice {
  return v === "athlete" || v === "coach"
}
function isPlanChoice(v: string | null): v is PlanChoice {
  return v === "free" || v === "premium"
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Prefill from URL: /signup?role=coach&plan=premium
  const [role, setRole] = React.useState<RoleChoice>(() => {
    const qp = searchParams?.get("role")
    return isRoleChoice(qp) ? qp : "athlete"
  })
  const [plan, setPlan] = React.useState<PlanChoice>(() => {
    const qp = searchParams?.get("plan")
    return isPlanChoice(qp) ? qp : "free"
  })

  // Keep in sync if navigation updates query params
  React.useEffect(() => {
    const qpRole = searchParams?.get("role")
    const qpPlan = searchParams?.get("plan")
    if (isRoleChoice(qpRole) && qpRole !== role) setRole(qpRole)
    if (isPlanChoice(qpPlan) && qpPlan !== plan) setPlan(qpPlan)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const [email, setEmail] = React.useState("")
  const [name, setName] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const isPremium = plan === "premium"
  const personaLabel = role === "athlete" ? "Athlète" : "Coach"
  const planLabel = isPremium ? "Premium" : "Free"

  async function submitSignup() {
    setError(null)
    setLoading(true)

    if (!email.trim()) {
      setLoading(false)
      setError("Merci de renseigner un email.")
      return
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          plan,
          email: email.trim(),
          name: name.trim() || null,
        }),
      })

      const data = (await res.json().catch(() => null)) as SignupResponse | null

      if (!res.ok || !data) {
        setError(data?.error ?? "Erreur serveur")
        return
      }

      if (!data.ok) {
        setError(data.error ?? "Inscription impossible")
        return
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }

      if (data.redirectTo) {
        router.push(data.redirectTo)
        return
      }

      router.push(role === "athlete" ? "/messages" : "/coach")
    } catch {
      setError("Erreur réseau, merci de réessayer.")
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void submitSignup()
  }

  const submitLabel = isPremium
    ? `Continuer vers le paiement ${personaLabel} Premium`
    : `Créer mon compte ${personaLabel} Free`

  // --- DS-safe building blocks (tokens only)
  const shell =
    "min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]"
  const container =
    "mx-auto flex min-h-[100dvh] w-full max-w-5xl items-center justify-center px-6 py-10 sm:py-14"
  const card =
    [
      "w-full max-w-xl rounded-3xl",
      "border border-[var(--border)]",
      "bg-[var(--bg-elev)]",
      "shadow-[var(--card-shadow-elevated)]",
      "supports-[backdrop-filter]:backdrop-blur-[var(--header-backdrop)]",
    ].join(" ")

  const cardInner = "p-6 sm:p-8"
  const eyebrow = "text-xs font-medium tracking-wide text-[var(--text-muted)]"
  const title = "mt-2 text-2xl font-semibold tracking-tight"
  const subtitle = "mt-2 text-sm leading-relaxed text-[var(--text-muted)]"

  const divider = "my-6 h-px w-full bg-[var(--border)]"

  const label = "text-xs font-medium text-[var(--text-muted)]"
  const helper = "text-xs text-[var(--text-muted)]"

  const input =
    [
      "h-11 w-full rounded-2xl",
      "border border-[var(--border)] bg-transparent",
      "px-3 text-sm text-[var(--text)]",
      "outline-none",
      "placeholder:text-[var(--text-muted)]",
      "focus:border-[var(--text)]",
      // no layout shift, no padding change
      "transition-[border-color] duration-200",
    ].join(" ")

  const segmentWrap =
    "grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-transparent p-1"
  const segmentBtnBase =
    "h-10 rounded-xl text-sm font-medium transition-[opacity] duration-200"
  const segmentBtnActive =
    "opacity-100"
  const segmentBtnInactive =
    "opacity-70 hover:opacity-90"

  return (
    <main className={shell}>
      <div className={container}>
        <div className={card}>
          <div className={cardInner}>
            <p className={eyebrow}>Créer un compte</p>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className={title}>Rencontre Coach</h1>
                <p className={subtitle}>
                  Une inscription simple. Une expérience premium.
                </p>
              </div>

              {/* Badge contextuel, ultra sobre */}
              <div
                className={[
                  "shrink-0 rounded-2xl border border-[var(--border)]",
                  "bg-[var(--header-bg)] px-3 py-2",
                ].join(" ")}
                aria-label="Offre sélectionnée"
              >
                <div className="text-xs font-semibold">
                  {personaLabel} {planLabel}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {isPremium ? "Accès complet" : "Découverte"}
                </div>
              </div>
            </div>

            <div className={divider} />

            <form onSubmit={handleSubmit} className="grid gap-6">
              {/* Role */}
              <section className="grid gap-2">
                <p className={label}>Je suis…</p>

                <div className={segmentWrap} role="group" aria-label="Choix du rôle">
                  <button
                    type="button"
                    onClick={() => setRole("athlete")}
                    className={[
                      segmentBtnBase,
                      role === "athlete"
                        ? [
                            segmentBtnActive,
                            "bg-[var(--header-bg)] border border-[var(--header-border)]",
                          ].join(" ")
                        : [
                            segmentBtnInactive,
                            "bg-transparent border border-transparent",
                          ].join(" "),
                    ].join(" ")}
                    aria-pressed={role === "athlete"}
                  >
                    Athlète
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("coach")}
                    className={[
                      segmentBtnBase,
                      role === "coach"
                        ? [
                            segmentBtnActive,
                            "bg-[var(--header-bg)] border border-[var(--header-border)]",
                          ].join(" ")
                        : [
                            segmentBtnInactive,
                            "bg-transparent border border-transparent",
                          ].join(" "),
                    ].join(" ")}
                    aria-pressed={role === "coach"}
                  >
                    Coach
                  </button>
                </div>
              </section>

              {/* Plan */}
              <section className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className={label}>Choix d’offre</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {isPremium ? "Recommandé pour progresser vite" : "Idéal pour découvrir"}
                  </p>
                </div>

                <div className={segmentWrap} role="group" aria-label="Choix du plan">
                  <button
                    type="button"
                    onClick={() => setPlan("free")}
                    className={[
                      segmentBtnBase,
                      plan === "free"
                        ? [
                            segmentBtnActive,
                            "bg-[var(--header-bg)] border border-[var(--header-border)]",
                          ].join(" ")
                        : [
                            segmentBtnInactive,
                            "bg-transparent border border-transparent",
                          ].join(" "),
                    ].join(" ")}
                    aria-pressed={plan === "free"}
                  >
                    {personaLabel} Free
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlan("premium")}
                    className={[
                      segmentBtnBase,
                      plan === "premium"
                        ? [
                            segmentBtnActive,
                            "bg-[var(--header-bg)] border border-[var(--header-border)]",
                          ].join(" ")
                        : [
                            segmentBtnInactive,
                            "bg-transparent border border-transparent",
                          ].join(" "),
                    ].join(" ")}
                    aria-pressed={plan === "premium"}
                  >
                    {personaLabel} Premium
                  </button>
                </div>
              </section>

              {/* Inputs */}
              <section className="grid gap-4">
                <div className="grid gap-1.5">
                  <label className={label} htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ton.email@example.com"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className={label} htmlFor="name">
                    Prénom / pseudo <span className="text-[var(--text-muted)]">(optionnel)</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    className={input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={capitalize(personaLabel)}
                  />
                </div>
              </section>

              {/* Error */}
              {error ? (
                <div
                  className={[
                    "rounded-2xl border border-[var(--border)]",
                    "bg-[var(--header-bg)] px-4 py-3",
                  ].join(" ")}
                  role="alert"
                  aria-live="polite"
                >
                  <p className="text-sm text-[var(--danger)]">{error}</p>
                </div>
              ) : null}

              {/* Submit */}
              <div className="grid gap-3">
                <Button type="submit" loading={loading} fullWidth>
                  {submitLabel}
                </Button>

                <p className={helper}>
                  En continuant, tu acceptes que l’accès Premium passe par Stripe (mode test / carte
                  4242… en dev).
                </p>

                <p className={helper}>
                  Déjà un compte ?{" "}
                  <a
                    href="/login?next=/hub"
                    className="underline underline-offset-4 decoration-[var(--border)] hover:opacity-90"
                  >
                    Se connecter
                  </a>
                </p>
              </div>
            </form>
          </div>

          {/* Footer micro trust bar */}
          <div className="border-t border-[var(--border)] px-6 py-4 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--text-muted)]">
                Paiement sécurisé • Résiliation simple
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Support rapide • Expérience premium
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
