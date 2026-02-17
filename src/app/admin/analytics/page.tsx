// src/app/admin/analytics/page.tsx
"use client";

import * as React from "react";

function safeGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

type FunnelRow = {
  step: string;
  reached: number;
  dropOffFromPrev: number;
  stepConversionFromPrev: number;
};

type AnalyticsResponse = {
  ok: boolean;
  totalEvents: number;
  uniqueSessions: number;
  counts: Record<string, number>;
  funnel: FunnelRow[];
  conversionRate: number;
  mediansMs: Record<string, number | null>;
  recentSessions: Array<{
    sessionId: string;
    lastTs: number;
    role?: string;
    offer?: string;
    billing?: string;
    steps: Record<string, number | undefined>;
  }>;
};

type OverviewResponse = {
  range: "7d" | "30d" | "90d";
  window: { start: string; end: string };
  counts: {
    sessions: number;
    hero_sessions: number;
    pricing_sessions: number;
    signup_sessions: number;
    paid_sessions: number;
  };
  rates: {
    signup_rate: number;
    hero_to_signup: number;
    signup_to_paid: number;
    hero_to_paid: number;
  };
};

function pct(n: number | null | undefined) {
  const x = typeof n === "number" ? n : 0;
  return `${Math.round(x * 1000) / 10}%`;
}

function fmtMs(ms: number | null) {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return `${m}m`;
}

export default function AnalyticsPage() {
  const [range, setRange] = React.useState<"7d" | "30d" | "90d">("30d");
  const [role, setRole] = React.useState<string>("");
  const [offer, setOffer] = React.useState<string>("");
  const [billing, setBilling] = React.useState<string>("");

  const [adminKey, setAdminKey] = React.useState<string>("");
  const [data, setData] = React.useState<AnalyticsResponse | null>(null);
  const [overview, setOverview] = React.useState<OverviewResponse | null>(null);

  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const stored = safeGet("rc_admin_key") || "";
    setAdminKey(stored);
  }, []);

  const load = React.useCallback(
    async (keyOverride?: unknown) => {
      setError(null);

      const key =
        typeof keyOverride === "string" ? keyOverride.trim() : adminKey.trim();

      if (!key) {
        setData(null);
        setOverview(null);
        setError("Renseigne la clé admin puis clique Save.");
        return;
      }

      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("range", range);
        if (role) qs.set("role", role);
        if (offer) qs.set("offer", offer);
        if (billing) qs.set("billing", billing);

        // 1) Conversion dashboard (ton endpoint existant)
        const res = await fetch(`/api/analytics?${qs.toString()}`, {
          headers: { "x-admin-key": key },
          cache: "no-store",
        });

        if (!res.ok) {
          setData(null);
          setOverview(null);
          setError(
            res.status === 401
              ? "Clé admin invalide."
              : `Erreur API analytics (${res.status}).`
          );
          return;
        }

        const json = (await res.json()) as AnalyticsResponse;
        setData(json);

        // 2) SaaS Overview (nouveau endpoint admin)
        const res2 = await fetch(`/api/admin/analytics/overview?${qs.toString()}`, {
          headers: { "x-admin-key": key },
          cache: "no-store",
        });

        if (res2.ok) {
          const json2 = (await res2.json()) as OverviewResponse;
          setOverview(json2);
        } else {
          // on ne casse pas la page si overview pas encore branché
          setOverview(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [range, role, offer, billing, adminKey]
  );

  const [savedHint, setSavedHint] = React.useState<string | null>(null);

  const onSaveKey = React.useCallback(() => {
    const key = adminKey.trim();
    if (!key) {
      setError("Colle une clé avant de sauvegarder.");
      return;
    }

    const ok = safeSet("rc_admin_key", key);
    setSavedHint(ok ? "Saved" : "Saved (sans localStorage)");

    // force le load avec la clé “instant”
    void load(key);
  }, [adminKey, load]);

  const onReset = React.useCallback(async () => {
    if (!adminKey.trim()) {
      setError("Renseigne la clé admin avant de reset.");
      return;
    }
    const ok = window.confirm("Reset analytics ?");
    if (!ok) return;

    const res = await fetch("/api/analytics", {
      method: "DELETE",
      headers: { "x-admin-key": adminKey.trim() },
    });

    if (!res.ok) {
      setError("Reset refusé (clé admin ?).");
      return;
    }

    void load();
  }, [adminKey, load]);

  const maxReached = data ? Math.max(...data.funnel.map((x) => x.reached), 1) : 1;

  return (
    <main className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)] p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Analytics</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Control Center • Funnel • Segments • Paid conversion (phase 1)
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-2">
              <input
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="ADMIN_DASHBOARD_KEY"
                className="h-9 w-[260px] bg-transparent px-2 text-sm outline-none"
              />
              <button
                onClick={onSaveKey}
                className="h-9 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 text-sm font-medium"
              >
                Save
              </button>
            </div>

            <button
              onClick={onReset}
              disabled={!adminKey.trim()}
              className={[
                "h-10 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 text-sm font-medium",
                !adminKey.trim() ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select label="Range" value={range} onChange={(v) => setRange(v as any)} options={["7d", "30d", "90d"]} />
          <Select label="Role" value={role} onChange={setRole} options={["", "athlete", "coach", "admin"]} />
          <Select label="Offer" value={offer} onChange={setOffer} options={["", "standard", "pro", "free"]} />
          <Select label="Billing" value={billing} onChange={setBilling} options={["", "monthly", "yearly"]} />

          <button
            onClick={() => void load()}
            disabled={!adminKey.trim() || loading}
            className={[
              "h-10 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 text-sm font-medium",
              !adminKey.trim() || loading ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>

        {savedHint ? <div className="text-xs text-[var(--text-muted)]">{savedHint}</div> : null}

        {!adminKey.trim() ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 text-sm text-[var(--text-muted)]">
            Colle ta clé (dans l’input), puis clique <span className="font-medium">Save</span>.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 text-sm text-[var(--text-muted)]">
            {error}
          </div>
        ) : null}

        {/* ✅ SaaS Overview */}
        {overview ? (
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Sessions" value={overview.counts.sessions} />
            <Stat label="Signup rate" value={pct(overview.rates.signup_rate)} />
            <Stat label="Signup → Paid" value={pct(overview.rates.signup_to_paid)} />
            <Stat label="Hero → Paid" value={pct(overview.rates.hero_to_paid)} />
          </div>
        ) : null}

        {!data ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 text-sm text-[var(--text-muted)]">
            {adminKey.trim() ? "Clique Apply pour charger les stats." : "En attente de la clé admin."}
          </div>
        ) : (
          <>
            {/* ✅ Ton dashboard conversion existant */}
            <div className="grid gap-4 md:grid-cols-4">
              <Stat label="Events" value={data.totalEvents} />
              <Stat label="Sessions" value={data.uniqueSessions} />
              <Stat label="Signup" value={data.counts["signup_submit"] ?? 0} />
              <Stat label="Conv (Hero→Signup)" value={`${data.conversionRate}%`} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Funnel (sessions uniques)">
                <div className="space-y-3">
                  {data.funnel.map((row) => (
                    <FunnelBar
                      key={row.step}
                      step={row.step}
                      reached={row.reached}
                      drop={row.dropOffFromPrev}
                      conv={row.stepConversionFromPrev}
                      max={maxReached}
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="Temps médian vers Signup">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat label="Hero → Signup" value={fmtMs(data.mediansMs.hero_to_signup)} />
                  <MiniStat label="Pricing → Signup" value={fmtMs(data.mediansMs.pricing_to_signup)} />
                  <MiniStat label="Sticky → Signup" value={fmtMs(data.mediansMs.sticky_to_signup)} />
                  <MiniStat label="FinalCTA → Signup" value={fmtMs(data.mediansMs.finalcta_to_signup)} />
                </div>
              </Panel>
            </div>

            <Panel title="Recent sessions (50)">
              <div className="overflow-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left text-xs text-[var(--text-muted)]">
                      <th className="pb-3 pr-4">Session</th>
                      <th className="pb-3 pr-4">Role</th>
                      <th className="pb-3 pr-4">Offer</th>
                      <th className="pb-3 pr-4">Billing</th>
                      <th className="pb-3 pr-4">Steps</th>
                      <th className="pb-3 pr-0">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentSessions.map((s) => (
                      <tr key={s.sessionId} className="border-t border-[var(--border)]">
                        <td className="py-3 pr-4 text-sm font-medium">
                          {s.sessionId === "unknown" ? "unknown" : s.sessionId.slice(0, 8)}
                        </td>
                        <td className="py-3 pr-4 text-sm text-[var(--text-muted)]">{s.role ?? "—"}</td>
                        <td className="py-3 pr-4 text-sm text-[var(--text-muted)]">{s.offer ?? "—"}</td>
                        <td className="py-3 pr-4 text-sm text-[var(--text-muted)]">{s.billing ?? "—"}</td>
                        <td className="py-3 pr-4 text-xs text-[var(--text-muted)]">{stepsCompact(s.steps)}</td>
                        <td className="py-3 pr-0 text-xs text-[var(--text-muted)]">
                          {new Date(s.lastTs).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </div>
    </main>
  );
}

function stepsCompact(steps: Record<string, number | undefined>) {
  const order = ["hero_click", "pricing_click", "sticky_click", "finalcta_click", "signup_submit"];
  return order
    .map((k) => (steps[k] ? k.replace("_click", "").replace("signup_submit", "signup") : null))
    .filter(Boolean)
    .join(" → ");
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
      <div className="text-sm text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}

function FunnelBar({
  step,
  reached,
  drop,
  conv,
  max,
}: {
  step: string;
  reached: number;
  drop: number;
  conv: number;
  max: number;
}) {
  const pctW = max > 0 ? (reached / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{step}</span>
        <span>
          {reached} • -{drop} • {conv}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--bg-muted)]">
        <div
          className="h-2 rounded-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: `${pctW}%` }}
        />
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2 text-sm">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 bg-transparent text-sm outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "" ? "all" : o}
          </option>
        ))}
      </select>
    </label>
  );
}
