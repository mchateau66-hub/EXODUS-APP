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

type PathsOk = {
  ok: true;
  range: RangeKey | string;
  window: { start: string; end: string };
  totals: { sessions: number; signup_sessions: number; paid_sessions: number };
  top: {
    all: Array<{ path: string; sessions: number; share: number; signup_sessions: number; paid_sessions: number }>;
    signup: Array<{ path: string; sessions: number; share: number }>;
    paid: Array<{ path: string; sessions: number; share: number }>;
  };
};

function isPathsOk(x: unknown): x is PathsOk {
  if (!x || typeof x !== "object") return false;
  const o = x as any;
  return (
    o.ok === true &&
    o.window &&
    typeof o.window.start === "string" &&
    typeof o.window.end === "string" &&
    o.totals &&
    typeof o.totals.sessions === "number" &&
    o.top &&
    Array.isArray(o.top.all) &&
    Array.isArray(o.top.signup) &&
    Array.isArray(o.top.paid)
  );
}

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}

export default function PathsPage() {
  const [adminKey, setAdminKey] = React.useState("");
  const [savedHint, setSavedHint] = React.useState<string | null>(null);

  const [range, setRange] = React.useState<RangeKey>("30d");
  const [role, setRole] = React.useState("");
  const [offer, setOffer] = React.useState("");
  const [billing, setBilling] = React.useState("");

  const [data, setData] = React.useState<PathsOk | null>(null);
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

      const res = await fetch(`/api/admin/analytics/paths?${qs.toString()}`, {
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
      if (!isPathsOk(json)) {
        setData(null);
        setError("Réponse API invalide (shape inattendu). Vérifie /paths.");
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
          <h2 className="text-xl font-semibold">Top paths</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Séquences d’events par session • top global • top vers signup • top vers paid
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
          {hasKey ? "Clique Apply pour charger les paths." : "En attente de la clé admin."}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Fenêtre</span>
              <span>
                {start ? start.toLocaleDateString() : "—"} → {end ? end.toLocaleDateString() : "—"}
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Sessions" value={String(data.totals.sessions)} />
              <MiniStat label="Signup sessions" value={String(data.totals.signup_sessions)} />
              <MiniStat label="Paid sessions" value={String(data.totals.paid_sessions)} />
            </div>
          </div>

          <Panel title="Top paths (global)">
            <PathsTable
              rows={data.top.all.map((r) => ({
                path: r.path,
                sessions: r.sessions,
                share: r.share,
                extra: `signup ${r.signup_sessions} • paid ${r.paid_sessions}`,
              }))}
            />
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Top paths → Signup">
              <PathsTable rows={data.top.signup.map((r) => ({ path: r.path, sessions: r.sessions, share: r.share }))} />
            </Panel>

            <Panel title="Top paths → Paid">
              <PathsTable rows={data.top.paid.map((r) => ({ path: r.path, sessions: r.sessions, share: r.share }))} />
            </Panel>
          </div>
        </div>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}

function PathsTable({
  rows,
}: {
  rows: Array<{ path: string; sessions: number; share: number; extra?: string }>;
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-[var(--text-muted)]">Aucune donnée.</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-xs text-[var(--text-muted)]">
            <th className="pb-3 pr-4">Path</th>
            <th className="pb-3 pr-4">Sessions</th>
            <th className="pb-3 pr-4">Share</th>
            <th className="pb-3 pr-0">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.path} className="border-t border-[var(--border)]">
              <td className="py-3 pr-4 text-sm font-medium whitespace-nowrap">{r.path}</td>
              <td className="py-3 pr-4 text-sm text-[var(--text-muted)]">{r.sessions}</td>
              <td className="py-3 pr-4 text-sm">{pct(r.share)}</td>
              <td className="py-3 pr-0 text-xs text-[var(--text-muted)]">{r.extra ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
