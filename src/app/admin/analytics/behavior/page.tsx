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

type BehaviorOk = {
  ok: true;
  range: RangeKey | string;
  window: { start: string; end: string };
  counts: {
    sessions: number;
    signup_sessions: number;
    signup_with_sticky: number;
    signup_without_sticky: number;
    fast_lane: number;
    slow_lane: number;
  };
  rates: {
    sticky_influence_rate: number;
    fast_lane_rate: number;
    slow_lane_rate: number;
  };
  time_to_convert_ms: {
    p50: number | null;
    p75: number | null;
    p90: number | null;
    sample_size: number;
    histogram: Record<string, number>;
    hero_to_signup_p50: number | null;
  };
};

type BehaviorResponse = BehaviorOk | { ok: false; error?: string };

function isBehaviorOk(x: unknown): x is BehaviorOk {
  if (!x || typeof x !== "object") return false;
  const o = x as any;
  return (
    o.ok === true &&
    o.window &&
    typeof o.window.start === "string" &&
    typeof o.window.end === "string" &&
    o.counts &&
    typeof o.counts.sessions === "number" &&
    typeof o.counts.signup_sessions === "number" &&
    o.rates &&
    typeof o.rates.sticky_influence_rate === "number" &&
    o.time_to_convert_ms &&
    typeof o.time_to_convert_ms.sample_size === "number" &&
    o.time_to_convert_ms.histogram &&
    typeof o.time_to_convert_ms.histogram === "object"
  );
}

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}

function fmtMs(ms: number | null) {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return `${m}m`;
}

export default function BehaviorPage() {
  const [adminKey, setAdminKey] = React.useState("");
  const [savedHint, setSavedHint] = React.useState<string | null>(null);

  const [range, setRange] = React.useState<RangeKey>("30d");
  const [role, setRole] = React.useState("");
  const [offer, setOffer] = React.useState("");
  const [billing, setBilling] = React.useState("");

  const [data, setData] = React.useState<BehaviorOk | null>(null);
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

      const res = await fetch(`/api/admin/analytics/behavior?${qs.toString()}`, {
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

      if (!isBehaviorOk(json)) {
        setData(null);
        setError("Réponse API invalide (shape inattendu). Vérifie /api/admin/analytics/behavior.");
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

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Behavior</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Sticky impact • Fast vs Slow lane • Time-to-convert distribution
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
        <Select label="Offer" value={offer} onChange={setOffer} options={["", "standard", "pro", "free"]} />
        <Select label="Billing" value={billing} onChange={setBilling} options={["", "monthly", "yearly"]} />
      </div>

      {!data ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 text-sm text-[var(--text-muted)]">
          {hasKey ? "Clique Apply pour charger le behavior." : "En attente de la clé admin."}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Fenêtre</span>
            <span>
              {start ? start.toLocaleDateString() : "—"} → {end ? end.toLocaleDateString() : "—"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Sessions" value={data.counts.sessions} />
            <Stat label="Signup sessions" value={data.counts.signup_sessions} />
            <Stat label="Sticky influence" value={pct(data.rates.sticky_influence_rate)} />
            <Stat label="Fast lane" value={pct(data.rates.fast_lane_rate)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Sticky impact (among signups)">
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniStat label="Signups with sticky" value={String(data.counts.signup_with_sticky)} />
                <MiniStat label="Signups without sticky" value={String(data.counts.signup_without_sticky)} />
              </div>
              <div className="mt-4 text-sm text-[var(--text-muted)]">
                Sticky influence rate = {pct(data.rates.sticky_influence_rate)} (sticky_click avant signup_submit)
              </div>
            </Panel>

            <Panel title="Fast vs Slow lane (among signups)">
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniStat
                  label="Fast lane (no pricing)"
                  value={`${data.counts.fast_lane} • ${pct(data.rates.fast_lane_rate)}`}
                />
                <MiniStat
                  label="Slow lane (pricing first)"
                  value={`${data.counts.slow_lane} • ${pct(data.rates.slow_lane_rate)}`}
                />
              </div>
              <div className="mt-4 text-sm text-[var(--text-muted)]">
                Slow lane = pricing_click avant signup_submit
              </div>
            </Panel>
          </div>

          <Panel title="Time to convert (first touch → signup)">
            <div className="grid gap-4 md:grid-cols-4">
              <MiniStat label="P50" value={fmtMs(data.time_to_convert_ms.p50)} />
              <MiniStat label="P75" value={fmtMs(data.time_to_convert_ms.p75)} />
              <MiniStat label="P90" value={fmtMs(data.time_to_convert_ms.p90)} />
              <MiniStat label="Sample size" value={String(data.time_to_convert_ms.sample_size)} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-5">
              {Object.entries(data.time_to_convert_ms.histogram).map(([k, v]) => (
                <MiniStat key={k} label={k} value={String(v)} />
              ))}
            </div>

            <div className="mt-4 text-sm text-[var(--text-muted)]">
              (Bonus) Hero → Signup P50: {fmtMs(data.time_to_convert_ms.hero_to_signup_p50)}
            </div>
          </Panel>
        </>
      )}
    </main>
  );
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
