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

type RangeKey = "7d" | "30d" | "90d";

type MatrixRow = {
  offer: string;
  billing: string;
  sessions: number;
  hero_sessions: number;
  pricing_sessions: number;
  signup_sessions: number;
  paid_sessions: number;

  pricing_rate_from_hero: number;
  signup_rate_from_pricing: number;
  paid_rate_from_signup: number;
  hero_to_paid: number;
};

type MatrixOk = {
  ok: true;
  range: RangeKey | string;
  window: { start: string; end: string };
  dims: { offers: string[]; billings: string[] };
  data: MatrixRow[];
};

function isMatrixOk(x: unknown): x is MatrixOk {
  if (!x || typeof x !== "object") return false;
  const o = x as any;
  return (
    o.ok === true &&
    o.window &&
    typeof o.window.start === "string" &&
    typeof o.window.end === "string" &&
    o.dims &&
    Array.isArray(o.dims.offers) &&
    Array.isArray(o.dims.billings) &&
    Array.isArray(o.data)
  );
}

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}

export default function PricingMatrixPage() {
  const [adminKey, setAdminKey] = React.useState("");
  const [savedHint, setSavedHint] = React.useState<string | null>(null);

  const [range, setRange] = React.useState<RangeKey>("30d");
  const [role, setRole] = React.useState("");
  const [offer, setOffer] = React.useState("");
  const [billing, setBilling] = React.useState("");

  const [data, setData] = React.useState<MatrixOk | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setAdminKey(safeGet("rc_admin_key") || "");
  }, []);

  const onSaveKey = React.useCallback(() => {
    const k = adminKey.trim();
    if (!k) {
      setError("Colle une clé avant de sauvegarder.");
      return;
    }
    const ok = safeSet("rc_admin_key", k);
    setSavedHint(ok ? "Saved" : "Saved (sans localStorage)");
    setError(null);
  }, [adminKey]);

  const load = React.useCallback(async () => {
    const key = adminKey.trim();
    if (!key) {
      setData(null);
      setError("Renseigne la clé admin puis clique Save.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams();
      qs.set("range", range);
      if (role) qs.set("role", role);
      if (offer) qs.set("offer", offer);
      if (billing) qs.set("billing", billing);

      const res = await fetch(`/api/admin/analytics/pricing-matrix?${qs.toString()}`, {
        headers: { "x-admin-key": key },
        cache: "no-store",
      });

      const ct = res.headers.get("content-type") || "";
      const isJson = ct.includes("application/json");

      if (!res.ok) {
        let message = res.status === 401 ? "Clé admin invalide." : `Erreur API (${res.status}).`;
        if (isJson) {
          try {
            const j = (await res.json()) as any;
            if (j?.error && typeof j.error === "string") message = j.error;
          } catch {}
        }
        setData(null);
        setError(message);
        return;
      }

      const json = (isJson ? await res.json() : null) as unknown;
      if (!isMatrixOk(json)) {
        setData(null);
        setError("Réponse API invalide (shape inattendu). Vérifie /pricing-matrix.");
        return;
      }

      setData(json);
    } catch (e: any) {
      setData(null);
      setError(e?.message ? String(e.message) : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, range, role, offer, billing]);

  const hasKey = Boolean(adminKey.trim());
  const start = data?.window?.start ? new Date(data.window.start) : null;
  const end = data?.window?.end ? new Date(data.window.end) : null;

  // index rows by (offer|billing)
  const cell = React.useMemo(() => {
    const m = new Map<string, MatrixRow>();
    for (const r of data?.data ?? []) m.set(`${r.offer}|||${r.billing}`, r);
    return m;
  }, [data]);

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Pricing drop-off matrix</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Offer × Billing • Hero→Pricing • Pricing→Signup • Signup→Paid • Hero→Paid
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-2">
            <input
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="ANALYTICS_ADMIN_KEY"
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
            onClick={() => void load()}
            disabled={!hasKey || loading}
            className={[
              "h-10 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 text-sm font-medium",
              !hasKey || loading ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>
      </div>

      {savedHint ? <div className="text-xs text-[var(--text-muted)]">{savedHint}</div> : null}
      {error ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 text-sm text-[var(--text-muted)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select label="Range" value={range} onChange={(v) => setRange(v as RangeKey)} options={["7d", "30d", "90d"]} />
        <Select label="Role" value={role} onChange={setRole} options={["", "athlete", "coach", "admin"]} />
        <Select label="Offer" value={offer} onChange={setOffer} options={["", "standard", "pro", "free", "—"]} />
        <Select label="Billing" value={billing} onChange={setBilling} options={["", "monthly", "yearly", "—"]} />
      </div>

      {!data ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 text-sm text-[var(--text-muted)]">
          {hasKey ? "Clique Apply pour charger la matrix." : "En attente de la clé admin."}
        </div>
      ) : data.data.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 text-sm text-[var(--text-muted)]">
          Aucun event dans cette fenêtre (ou filtres trop restrictifs).
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Fenêtre</span>
            <span>
              {start ? start.toLocaleDateString() : "—"} → {end ? end.toLocaleDateString() : "—"}
            </span>
          </div>

          <div className="overflow-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)]">
                  <th className="pb-3 pr-4">Offer \\ Billing</th>
                  {data.dims.billings.map((b) => (
                    <th key={b} className="pb-3 pr-4">
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.dims.offers.map((o) => (
                  <tr key={o} className="border-t border-[var(--border)] align-top">
                    <td className="py-3 pr-4 text-sm font-semibold">{o}</td>

                    {data.dims.billings.map((b) => {
                      const r = cell.get(`${o}|||${b}`);
                      return (
                        <td key={`${o}-${b}`} className="py-3 pr-4">
                          {!r ? (
                            <div className="text-xs text-[var(--text-muted)]">—</div>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-xs text-[var(--text-muted)]">
                                sessions {r.sessions} • hero {r.hero_sessions}
                              </div>
                              <div className="text-xs">
                                <span className="text-[var(--text-muted)]">Hero→Pricing </span>
                                <span className="font-medium">{pct(r.pricing_rate_from_hero)}</span>
                              </div>
                              <div className="text-xs">
                                <span className="text-[var(--text-muted)]">Pricing→Signup </span>
                                <span className="font-medium">{pct(r.signup_rate_from_pricing)}</span>
                              </div>
                              <div className="text-xs">
                                <span className="text-[var(--text-muted)]">Signup→Paid </span>
                                <span className="font-medium">{pct(r.paid_rate_from_signup)}</span>
                              </div>
                              <div className="text-xs">
                                <span className="text-[var(--text-muted)]">Hero→Paid </span>
                                <span className="font-medium">{pct(r.hero_to_paid)}</span>
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-[var(--text-muted)]">
            Notes: paid = checkout_success OR subscription_active. Si tu veux strict checkout_success uniquement, on switch.
          </div>
        </div>
      )}
    </main>
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
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 bg-transparent text-sm outline-none">
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "" ? "all" : o}
          </option>
        ))}
      </select>
    </label>
  );
}
