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
type ByKey = "role" | "offer" | "billing";

type SegmentRow = {
  key: string;
  sessions: number;
  hero_sessions: number;
  signup_sessions: number;
  paid_sessions: number;
  hero_to_signup: number; // 0..1
  hero_to_paid: number; // 0..1
};

type SegmentsResponse =
  | {
      ok: true;
      range: string;
      by: ByKey;
      window: { start: string; end: string };
      data: SegmentRow[];
    }
  | { ok: false; error?: string };

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}

function fmtKey(k: string) {
  if (!k || k === "—") return "—";
  return k;
}

function isSegmentsOk(x: unknown): x is Extract<SegmentsResponse, { ok: true }> {
  if (!x || typeof x !== "object") return false;
  const o = x as any;
  return (
    o.ok === true &&
    typeof o.range === "string" &&
    (o.by === "role" || o.by === "offer" || o.by === "billing") &&
    o.window &&
    typeof o.window.start === "string" &&
    typeof o.window.end === "string" &&
    Array.isArray(o.data)
  );
}

export default function SegmentsPage() {
  const [adminKey, setAdminKey] = React.useState("");
  const [savedHint, setSavedHint] = React.useState<string | null>(null);

  const [range, setRange] = React.useState<RangeKey>("30d");
  const [by, setBy] = React.useState<ByKey>("role");
  const [role, setRole] = React.useState("");
  const [offer, setOffer] = React.useState("");
  const [billing, setBilling] = React.useState("");

  const [data, setData] = React.useState<Extract<SegmentsResponse, { ok: true }> | null>(null);
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
      qs.set("by", by);
      if (role) qs.set("role", role);
      if (offer) qs.set("offer", offer);
      if (billing) qs.set("billing", billing);

      const res = await fetch(`/api/admin/analytics/segments?${qs.toString()}`, {
        headers: { "x-admin-key": key },
        cache: "no-store",
      });

      const ct = res.headers.get("content-type") || "";
      const maybeJson = ct.includes("application/json");

      if (!res.ok) {
        let message = res.status === 401 ? "Clé admin invalide." : `Erreur API (${res.status}).`;
        if (maybeJson) {
          try {
            const j = (await res.json()) as any;
            if (j?.error && typeof j.error === "string") message = j.error;
          } catch {}
        }
        setData(null);
        setError(message);
        return;
      }

      const json = (maybeJson ? await res.json() : null) as unknown;

      if (!isSegmentsOk(json)) {
        setData(null);
        setError("Réponse API invalide (shape inattendu). Vérifie la route /segments.");
        return;
      }

      // tri par volume hero desc (puis sessions)
      const sorted = [...json.data].sort((a, b) => {
        const d1 = (b.hero_sessions ?? 0) - (a.hero_sessions ?? 0);
        if (d1 !== 0) return d1;
        return (b.sessions ?? 0) - (a.sessions ?? 0);
      });

      setData({ ...json, data: sorted });
    } catch (e: any) {
      setData(null);
      setError(e?.message ? String(e.message) : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, range, by, role, offer, billing]);

  const hasKey = Boolean(adminKey.trim());
  const rows = data?.data ?? [];
  const start = data?.window?.start ? new Date(data.window.start) : null;
  const end = data?.window?.end ? new Date(data.window.end) : null;

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Segmentation</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Hero → Signup / Hero → Paid par segment (role, offer, billing)
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
        <Select label="By" value={by} onChange={(v) => setBy(v as ByKey)} options={["role", "offer", "billing"]} />
        <Select label="Role" value={role} onChange={setRole} options={["", "athlete", "coach", "admin"]} />
        <Select label="Offer" value={offer} onChange={setOffer} options={["", "standard", "pro", "free"]} />
        <Select label="Billing" value={billing} onChange={setBilling} options={["", "monthly", "yearly"]} />
      </div>

      {!data ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 text-sm text-[var(--text-muted)]">
          {hasKey ? "Clique Apply pour charger la segmentation." : "En attente de la clé admin."}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 text-sm text-[var(--text-muted)]">
          Aucun event dans cette fenêtre (ou filtres trop restrictifs).
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold">
              Segments ({data.by}) • {data.range}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {start ? start.toLocaleDateString() : "—"} → {end ? end.toLocaleDateString() : "—"}
            </div>
          </div>

          <div className="mt-4 overflow-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)]">
                  <th className="pb-3 pr-4">Segment</th>
                  <th className="pb-3 pr-4">Sessions</th>
                  <th className="pb-3 pr-4">Hero</th>
                  <th className="pb-3 pr-4">Signup</th>
                  <th className="pb-3 pr-4">Paid</th>
                  <th className="pb-3 pr-4">Hero→Signup</th>
                  <th className="pb-3 pr-0">Hero→Paid</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r) => (
                  <tr key={r.key} className="border-t border-[var(--border)]">
                    <td className="py-3 pr-4 text-sm font-medium">{fmtKey(r.key)}</td>
                    <td className="py-3 pr-4 text-sm text-[var(--text-muted)]">{r.sessions}</td>
                    <td className="py-3 pr-4 text-sm text-[var(--text-muted)]">{r.hero_sessions}</td>
                    <td className="py-3 pr-4 text-sm text-[var(--text-muted)]">{r.signup_sessions}</td>
                    <td className="py-3 pr-4 text-sm text-[var(--text-muted)]">{r.paid_sessions}</td>
                    <td className="py-3 pr-4 text-sm">{pct(r.hero_to_signup)}</td>
                    <td className="py-3 pr-0 text-sm">{pct(r.hero_to_paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs text-[var(--text-muted)]">
            Tip: tri par volume (hero_sessions) puis sessions. Si besoin, on passera à une requête SQL “top segments” plus
            poussée quand le volume monte.
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
