// src/app/admin/verification/ui/AdminVerificationClient.tsx
"use client";

import * as React from "react";

type DocRow = {
  id: string;
  userId: string;
  coachSlug: string | null;
  coachName: string | null;

  kind: string;
  title: string | null;
  status: string;

  reviewNote: string | null;
  reviewedAt: string | null;
  reviewerId: string | null;
  reviewerEmail: string | null;

  createdAt: string;
  url: string;
};

type Props = {
  initialRows: DocRow[];
};

const STATUS_OPTIONS = ["pending", "needs_review", "verified", "rejected"] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const KIND_OPTIONS = ["all", "diploma", "certification", "other"] as const;

function normalizeStatus(raw: string): Status {
  const s = String(raw ?? "").toLowerCase().trim();
  return (STATUS_OPTIONS as readonly string[]).includes(s) ? (s as Status) : "pending";
}

function statusLabel(s: string) {
  switch (s) {
    case "verified":
      return "verified ✅";
    case "needs_review":
      return "needs_review ⚠️";
    case "pending":
      return "pending ⏳";
    case "rejected":
      return "rejected ❌";
    default:
      return s;
  }
}

function badgeClasses(status: string) {
  switch (status) {
    case "verified":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-50";
    case "needs_review":
      return "border-amber-400/20 bg-amber-400/10 text-amber-50";
    case "pending":
      return "border-sky-400/20 bg-sky-400/10 text-sky-50";
    case "rejected":
      return "border-rose-400/25 bg-rose-400/10 text-rose-50";
    default:
      return "border-white/10 bg-white/5 text-white/80";
  }
}

function countByStatus(rows: DocRow[]) {
  const out: Record<Status, number> = {
    pending: 0,
    needs_review: 0,
    verified: 0,
    rejected: 0,
  };
  for (const r of rows) {
    const s = normalizeStatus(r.status);
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

function formatCounts(counts: Record<Status, number>) {
  return `pending ${counts.pending}, needs_review ${counts.needs_review}, verified ${counts.verified}, rejected ${counts.rejected}`;
}

function docShortLabel(d: DocRow) {
  const k = d.kind || "doc";
  const t = d.title ? ` — ${d.title}` : "";
  const s = normalizeStatus(d.status);
  return `${k}${t} [${s}]`;
}

function safeDateLabel(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function toCsv(rows: DocRow[]) {
  const headers = [
    "doc_id",
    "user_id",
    "coach_slug",
    "coach_name",
    "kind",
    "title",
    "status",
    "created_at",
    "reviewed_at",
    "reviewer_email",
    "reviewer_id",
    "review_note",
    "url",
  ];

  const escape = (v: unknown) => {
    const s = String(v ?? "");
    const needs = /[",\n\r]/.test(s);
    const out = s.replace(/"/g, '""');
    return needs ? `"${out}"` : out;
  };

  const lines = [headers.join(",")];

  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.userId,
        r.coachSlug ?? "",
        r.coachName ?? "",
        r.kind ?? "",
        r.title ?? "",
        normalizeStatus(r.status),
        r.createdAt ?? "",
        r.reviewedAt ?? "",
        r.reviewerEmail ?? "",
        r.reviewerId ?? "",
        r.reviewNote ?? "",
        r.url ?? "",
      ]
        .map(escape)
        .join(","),
    );
  }

  return lines.join("\n");
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type CoachGroup = {
  key: string;
  coachSlug: string | null;
  coachName: string | null;
  userId: string | null;
  docs: DocRow[];
  counts: Record<Status, number>;
  blockers: DocRow[];
};

function groupSortScore(g: CoachGroup) {
  // admin-first: rejected > verified > needs_review > pending
  if (g.counts.rejected > 0) return 0;
  if (g.counts.verified > 0) return 1;
  if (g.counts.needs_review > 0) return 2;
  if (g.counts.pending > 0) return 3;
  return 4;
}

type GroupScope = "all" | "pending" | "blockers";
const GROUP_SCOPE_OPTIONS: { value: GroupScope; label: string }[] = [
  { value: "all", label: "all docs" },
  { value: "pending", label: "pending only" },
  { value: "blockers", label: "blockers only" },
];

type GroupOpState = {
  scope: GroupScope;
  status: Status;
  note: string;
};

const DEFAULT_GROUP_OP: GroupOpState = {
  scope: "pending",
  status: "needs_review",
  note: "",
};

function idsForScope(docs: DocRow[], scope: GroupScope): string[] {
  const allowed = new Set<Status>(["pending", "needs_review"]);
  if (scope === "all") return docs.map((d) => d.id);
  if (scope === "pending") return docs.filter((d) => normalizeStatus(d.status) === "pending").map((d) => d.id);
  // blockers = docs NOT allowed (verified/rejected)
  return docs.filter((d) => !allowed.has(normalizeStatus(d.status))).map((d) => d.id);
}

export default function AdminVerificationClient({ initialRows }: Props) {
  const [rows, setRows] = React.useState<DocRow[]>(
    initialRows.map((r) => ({ ...r, status: normalizeStatus(r.status) })),
  );

  // Filters
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | Status>("all");
  const [kindFilter, setKindFilter] = React.useState<(typeof KIND_OPTIONS)[number]>("all");

  // Selection
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Saving
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [batchSaving, setBatchSaving] = React.useState(false);

  // Batch payload (global)
  const [batchStatus, setBatchStatus] = React.useState<Status>("needs_review");
  const [batchNote, setBatchNote] = React.useState<string>("");

  // Coach slug pick
  const [coachSlugPick, setCoachSlugPick] = React.useState<string>("");

  // Inspector panel + doc focus
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [inspectDocId, setInspectDocId] = React.useState<string | null>(null);

  // Group view
  const [groupView, setGroupView] = React.useState(true);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  // ✅ Group actions per coach
  const [groupOps, setGroupOps] = React.useState<Record<string, GroupOpState>>({});

  const [toast, setToast] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (statusFilter !== "all" && normalizeStatus(r.status) !== statusFilter) return false;
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;

      if (!needle) return true;

      const coachLabel = `${r.coachName ?? ""} ${r.coachSlug ?? ""}`.toLowerCase();
      const docLabel = `${r.kind ?? ""} ${r.title ?? ""} ${r.userId ?? ""}`.toLowerCase();
      return coachLabel.includes(needle) || docLabel.includes(needle);
    });
  }, [rows, q, statusFilter, kindFilter]);

  const statsAll = React.useMemo(() => countByStatus(rows), [rows]);
  const statsFiltered = React.useMemo(() => countByStatus(filtered), [filtered]);

  const filteredIds = React.useMemo(() => filtered.map((r) => r.id), [filtered]);
  const selectedCount = selected.size;

  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  const selectedRows = React.useMemo(() => {
    if (selected.size === 0) return [];
    const s = selected;
    return rows.filter((r) => s.has(r.id));
  }, [rows, selected]);

  const selectedCounts = React.useMemo(() => countByStatus(selectedRows), [selectedRows]);

  // Dropdown coachSlug options from FILTERED results
  const coachSlugOptions = React.useMemo(() => {
    const map = new Map<string, { slug: string; name: string | null; count: number }>();
    for (const r of filtered) {
      if (!r.coachSlug) continue;
      const key = r.coachSlug.toLowerCase();
      const prev = map.get(key);
      if (prev) prev.count += 1;
      else map.set(key, { slug: key, name: r.coachName ?? null, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => (a.slug > b.slug ? 1 : -1));
  }, [filtered]);

  // Grouped view
  const groups: CoachGroup[] = React.useMemo(() => {
    const map = new Map<string, CoachGroup>();

    for (const d of filtered) {
      const slug = (d.coachSlug ?? "").trim().toLowerCase();
      const key = slug ? `slug:${slug}` : `user:${d.userId}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          coachSlug: slug ? slug : null,
          coachName: d.coachName ?? null,
          userId: d.userId ?? null,
          docs: [d],
          counts: countByStatus([d]),
          blockers: [],
        });
      } else {
        existing.docs.push(d);
      }
    }

    // finalize counts + blockers
    const allowed = new Set<Status>(["pending", "needs_review"]);
    for (const g of map.values()) {
      g.counts = countByStatus(g.docs);
      g.blockers = g.docs.filter((x) => !allowed.has(normalizeStatus(x.status)));
      if (!g.coachName) g.coachName = g.docs.find((x) => x.coachName)?.coachName ?? null;
      if (!g.userId) g.userId = g.docs.find((x) => x.userId)?.userId ?? null;
    }

    return Array.from(map.values()).sort((a, b) => {
      const sa = groupSortScore(a);
      const sb = groupSortScore(b);
      if (sa !== sb) return sa - sb;
      const na = (a.coachSlug ?? a.coachName ?? a.userId ?? "").toLowerCase();
      const nb = (b.coachSlug ?? b.coachName ?? b.userId ?? "").toLowerCase();
      return na > nb ? 1 : -1;
    });
  }, [filtered]);

  const coachesCount = React.useMemo(() => groups.length, [groups]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllFiltered(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of filteredIds) next.add(id);
      } else {
        for (const id of filteredIds) next.delete(id);
      }
      return next;
    });
  }

  function setSelection(ids: string[]) {
    setSelected(new Set(ids));
  }

  function addToSelection(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function getPendingIdsInFiltered(): string[] {
    return filtered.filter((r) => normalizeStatus(r.status) === "pending").map((r) => r.id);
  }

  function getDocsByCoachSlugInFiltered(slug: string): DocRow[] {
    const s = slug.trim().toLowerCase();
    if (!s) return [];
    return filtered.filter((r) => (r.coachSlug ?? "").toLowerCase() === s);
  }

  const docsForPickedSlug = React.useMemo(() => {
    const slug = coachSlugPick.trim().toLowerCase();
    if (!slug) return [];
    return getDocsByCoachSlugInFiltered(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachSlugPick, filtered]);

  const coachPickedName = React.useMemo(() => {
    const first = docsForPickedSlug[0];
    return first?.coachName ?? null;
  }, [docsForPickedSlug]);

  const coachPickedCounts = React.useMemo(() => countByStatus(docsForPickedSlug), [docsForPickedSlug]);

  const coachPickedAllowed = React.useMemo(() => new Set<Status>(["pending", "needs_review"]), []);
  const coachPickedBlockers = React.useMemo(
    () => docsForPickedSlug.filter((d) => !coachPickedAllowed.has(normalizeStatus(d.status))),
    [docsForPickedSlug, coachPickedAllowed],
  );

  const inspectedDoc = React.useMemo(() => {
    if (!inspectDocId) return null;
    return rows.find((r) => r.id === inspectDocId) ?? null;
  }, [rows, inspectDocId]);

  function toggleGroupExpanded(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAllGroups() {
    setExpandedGroups(new Set(groups.map((g) => g.key)));
  }

  function collapseAllGroups() {
    setExpandedGroups(new Set());
  }

  async function onCopy(text: string, label: string) {
    const ok = await copyToClipboard(text);
    if (ok) {
      setToast(`${label} copié ✅`);
      setTimeout(() => setToast(null), 1600);
    } else {
      setToast(`Clipboard bloqué. (copie manuelle)`);
      setTimeout(() => setToast(null), 2000);
      // eslint-disable-next-line no-alert
      alert(text);
    }
  }

  function exportFilteredCsv() {
    const csv = toCsv(filtered);
    downloadTextFile(`coach-docs-filtered-${Date.now()}.csv`, csv);
  }

  function exportSelectionCsv() {
    const csv = toCsv(selectedRows);
    downloadTextFile(`coach-docs-selection-${Date.now()}.csv`, csv);
  }

  function exportCoachCsv(docs: DocRow[], slugOrKey: string) {
    const csv = toCsv(docs);
    const safe = slugOrKey.replace(/[^a-z0-9:_-]+/gi, "_");
    downloadTextFile(`coach-docs-${safe}-${Date.now()}.csv`, csv);
  }

  async function copySummary() {
    const slug = coachSlugPick.trim().toLowerCase();
    const lines: string[] = [];

    lines.push(`ADMIN VERIFICATION SUMMARY`);
    lines.push(`filtered: ${filtered.length} — ${formatCounts(statsFiltered)}`);
    lines.push(`all: ${rows.length} — ${formatCounts(statsAll)}`);
    lines.push(`selection: ${selectedRows.length} — ${formatCounts(selectedCounts)}`);
    lines.push(`coaches (grouped, filtered): ${coachesCount}`);

    if (slug) {
      lines.push(`coachSlug: ${slug} (${coachPickedName ?? "—"})`);
      lines.push(
        `coach docs in filters: ${docsForPickedSlug.length} — ${formatCounts(coachPickedCounts)}`,
      );
      if (coachPickedBlockers.length > 0) {
        lines.push(`blockers: ${coachPickedBlockers.length}`);
        for (const d of coachPickedBlockers.slice(0, 10)) {
          lines.push(`- ${docShortLabel(d)} (docId=${d.id})`);
        }
        if (coachPickedBlockers.length > 10) lines.push(`- ... (+${coachPickedBlockers.length - 10})`);
      } else {
        lines.push(`blockers: 0`);
      }
    }

    await onCopy(lines.join("\n"), "Summary");
  }

  async function saveRow(docId: string) {
    const row = rows.find((r) => r.id === docId);
    if (!row) return;

    setSavingId(docId);
    setToast(null);

    try {
      const res = await fetch(`/api/admin/coach-documents/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: normalizeStatus(row.status),
          review_note: row.reviewNote ?? null,
        }),
      });

      const data = (await res.json().catch(() => null)) as any;

      if (!res.ok || !data?.ok) {
        setToast(`Erreur: ${data?.error ?? "update_failed"}`);
        return;
      }

      const nowIso = new Date().toISOString();
      setRows((prev) => prev.map((x) => (x.id === docId ? { ...x, reviewedAt: nowIso } : x)));

      setToast("Mis à jour ✅");
    } finally {
      setSavingId(null);
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function applyBatchOnIds(ids: string[], status: Status, note: string | null) {
    if (ids.length === 0) {
      setToast("Sélection vide / scope vide.");
      setTimeout(() => setToast(null), 1800);
      return;
    }

    setBatchSaving(true);
    setToast(null);

    try {
      const res = await fetch(`/api/admin/coach-documents/batch`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status, review_note: note }),
      });

      const data = (await res.json().catch(() => null)) as any;

      if (!res.ok || !data?.ok) {
        setToast(`Erreur: ${data?.error ?? "batch_failed"}`);
        return;
      }

      const nowIso = new Date().toISOString();
      const idsSet = new Set(ids);

      setRows((prev) =>
        prev.map((r) =>
          idsSet.has(r.id) ? { ...r, status, reviewNote: note, reviewedAt: nowIso } : r,
        ),
      );

      setToast(`Batch appliqué (${ids.length}) ✅`);
    } finally {
      setBatchSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function applyBatchSelected() {
    const ids = Array.from(selected);
    const note = batchNote.trim() ? batchNote.trim() : null;
    await applyBatchOnIds(ids, batchStatus, note);
    clearSelection();
  }

  // Quick actions on selection
  async function quickVerified() {
    await applyBatchOnIds(Array.from(selected), "verified", null);
    clearSelection();
  }

  async function quickNeedsReview() {
    const note =
      batchNote.trim() ||
      "Merci de fournir un document lisible (nom/prénom, organisme, date) ou une preuve équivalente.";
    await applyBatchOnIds(Array.from(selected), "needs_review", note);
    clearSelection();
  }

  async function quickRejected() {
    const note =
      batchNote.trim() ||
      "Document refusé (incomplet / illisible / non conforme). Merci de renvoyer une preuve valide.";
    await applyBatchOnIds(Array.from(selected), "rejected", note);
    clearSelection();
  }

  // pending(filtered) -> needs_review (no note)
  async function quickPendingToNeedsReviewNoNote() {
    const ids = getPendingIdsInFiltered();
    if (ids.length === 0) {
      setToast("Aucun doc pending dans les filtres.");
      setTimeout(() => setToast(null), 1800);
      return;
    }
    await applyBatchOnIds(ids, "needs_review", null);
    clearSelection();
  }

  function selectPendingFiltered() {
    const ids = getPendingIdsInFiltered();
    if (ids.length === 0) {
      setToast("Aucun doc pending dans les filtres.");
      setTimeout(() => setToast(null), 1800);
      return;
    }
    setSelection(ids);
    setToast(`Sélection: ${ids.length} pending`);
    setTimeout(() => setToast(null), 1800);
  }

  function selectCoachDocsReplace(slug: string) {
    const s = slug.trim().toLowerCase();
    if (!s) return;
    const docs = getDocsByCoachSlugInFiltered(s);
    if (docs.length === 0) {
      setToast("Aucun doc pour ce coachSlug dans les filtres.");
      setTimeout(() => setToast(null), 1800);
      return;
    }
    setSelection(docs.map((d) => d.id));
    setToast(`Sélection: ${docs.length} docs (${s})`);
    setTimeout(() => setToast(null), 1800);
  }

  function addCoachDocs(slug: string) {
    const s = slug.trim().toLowerCase();
    if (!s) return;
    const docs = getDocsByCoachSlugInFiltered(s);
    if (docs.length === 0) {
      setToast("Aucun doc pour ce coachSlug dans les filtres.");
      setTimeout(() => setToast(null), 1800);
      return;
    }
    addToSelection(docs.map((d) => d.id));
    setToast(`+${docs.length} docs ajoutés (${s})`);
    setTimeout(() => setToast(null), 1800);
  }

  function filterToCoachSlug(slug: string) {
    const s = slug.trim().toLowerCase();
    if (!s) return;
    setQ(s);
    setToast(`Filtre: "${s}"`);
    setTimeout(() => setToast(null), 1500);
  }

  /**
   * SAFE+ Verify slug:
   * - autorisé uniquement si tous docs du coach (dans les filtres) sont pending/needs_review
   */
  async function quickVerifySlugSafePlus(slugOverride?: string) {
    const slug = (slugOverride ?? coachSlugPick).trim().toLowerCase();
    if (!slug) {
      setToast("Choisis un coachSlug.");
      setTimeout(() => setToast(null), 1800);
      return;
    }

    const docs = getDocsByCoachSlugInFiltered(slug);
    if (docs.length === 0) {
      setToast("Aucun doc pour ce coachSlug dans les filtres.");
      setTimeout(() => setToast(null), 1800);
      return;
    }

    const counts = countByStatus(docs);
    const allowed = new Set<Status>(["pending", "needs_review"]);
    const blockers = docs.filter((d) => !allowed.has(normalizeStatus(d.status)));

    setCoachSlugPick(slug);
    setPanelOpen(true);

    if (blockers.length > 0) {
      const uniqueBad = Array.from(new Set(blockers.map((d) => normalizeStatus(d.status)))).join(", ");
      const preview = blockers
        .slice(0, 4)
        .map((d) => `• ${docShortLabel(d)}`)
        .join(" | ");
      const more = blockers.length > 4 ? ` (+${blockers.length - 4} autres)` : "";

      setToast(
        `⚠️ Safe-guard: "${slug}" BLOQUÉ. Statuts: ${formatCounts(counts)}. Non autorisés: ${uniqueBad}. Bloquants: ${preview}${more}`,
      );
      setTimeout(() => setToast(null), 3500);
      return;
    }

    await applyBatchOnIds(
      docs.map((d) => d.id),
      "verified",
      null,
    );
    clearSelection();
  }

  // ✅ Group operations helpers
  function getGroupOp(key: string): GroupOpState {
    return groupOps[key] ?? DEFAULT_GROUP_OP;
  }

  function setGroupOp(key: string, patch: Partial<GroupOpState>) {
    setGroupOps((prev) => {
      const base = prev[key] ?? DEFAULT_GROUP_OP;
      return { ...prev, [key]: { ...base, ...patch } };
    });
  }

  async function applyGroupOp(g: CoachGroup) {
    const op = getGroupOp(g.key);
    const ids = idsForScope(g.docs, op.scope);
    const note = op.note.trim() ? op.note.trim() : null;

    // UX: focus coach slug in details
    if (g.coachSlug) setCoachSlugPick(g.coachSlug);

    await applyBatchOnIds(ids, op.status, note);
  }

  function getCoachLabel(g: CoachGroup) {
    const base = g.coachName ?? g.coachSlug ?? g.userId ?? "—";
    const slug = g.coachSlug ? ` (${g.coachSlug})` : "";
    return `${base}${slug}`;
  }

  return (
    <div>
      {toast ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80">
          {toast}
        </div>
      ) : null}

      {/* Stats */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
          All: {rows.length}
        </span>
        <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sky-50">
          pending: {statsAll.pending}
        </span>
        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-50">
          needs_review: {statsAll.needs_review}
        </span>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-50">
          verified: {statsAll.verified}
        </span>
        <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1 text-rose-50">
          rejected: {statsAll.rejected}
        </span>

        <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
          Filtered: {filtered.length} (p:{statsFiltered.pending} nr:{statsFiltered.needs_review} v:
          {statsFiltered.verified} r:{statsFiltered.rejected})
          <span className="mx-2 text-white/25">•</span>
          Coaches: {coachesCount}
        </span>
      </div>

      {/* Filters + actions */}
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white placeholder:text-white/35"
            placeholder="Recherche coach / slug / userId / titre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">Tous statuts</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>

          <select
            className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as any)}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k === "all" ? "Tous types" : k}
              </option>
            ))}
          </select>

          <div className="text-xs text-white/55">{filtered.length} résultat(s)</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-white/60">
              Sélection : <span className="font-semibold text-white/85">{selectedCount}</span>
            </div>

            <label className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={(e) => setAllFiltered(e.target.checked)}
              />
              Select filtered
            </label>

            <button
              type="button"
              onClick={selectPendingFiltered}
              className="inline-flex items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-50 hover:bg-sky-400/15"
              title="Sélectionne tous les docs pending dans les filtres"
            >
              Select pending (filtered)
            </button>

            {/* Coach slug pick */}
            <div className="flex items-center gap-2">
              <select
                className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                value={coachSlugPick}
                onChange={(e) => {
                  setCoachSlugPick(e.target.value);
                  setPanelOpen(true);
                }}
                title="Coach slug (options dérivées des résultats filtrés)"
              >
                <option value="">Coach slug…</option>
                {coachSlugOptions.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.slug} {c.name ? `— ${c.name}` : ""} ({c.count})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  const s = coachSlugPick.trim().toLowerCase();
                  if (!s) return;
                  selectCoachDocsReplace(s);
                }}
                disabled={!coachSlugPick.trim()}
                className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
                  !coachSlugPick.trim()
                    ? "cursor-not-allowed bg-white/10 text-white/45"
                    : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                Select coach
              </button>

              <button
                type="button"
                onClick={() => {
                  const s = coachSlugPick.trim().toLowerCase();
                  if (!s) return;
                  addCoachDocs(s);
                }}
                disabled={!coachSlugPick.trim()}
                className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
                  !coachSlugPick.trim()
                    ? "cursor-not-allowed bg-white/10 text-white/45"
                    : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                + coach
              </button>

              <button
                type="button"
                onClick={() => filterToCoachSlug(coachSlugPick)}
                disabled={!coachSlugPick.trim()}
                className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
                  !coachSlugPick.trim()
                    ? "cursor-not-allowed bg-white/10 text-white/45"
                    : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                Filter coach
              </button>

              <button
                type="button"
                disabled={batchSaving || !coachSlugPick.trim()}
                onClick={() => quickVerifySlugSafePlus(coachSlugPick)}
                className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
                  batchSaving || !coachSlugPick.trim()
                    ? "cursor-not-allowed bg-emerald-400/10 text-emerald-50/40"
                    : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-50 hover:bg-emerald-400/15"
                }`}
                title="SAFE+: verified uniquement si tous les docs (dans les filtres) sont pending/needs_review"
              >
                ✅ Verify coach (slug)
              </button>
            </div>

            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
            >
              Clear
            </button>

            <div className="h-6 w-px bg-white/10" />

            {/* Batch payload (global) */}
            <select
              className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              value={batchStatus}
              onChange={(e) => setBatchStatus(e.target.value as Status)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>

            <input
              className="min-w-[220px] flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white placeholder:text-white/35"
              placeholder="review_note (optionnel)"
              value={batchNote}
              onChange={(e) => setBatchNote(e.target.value)}
            />

            <button
              type="button"
              disabled={batchSaving || selectedCount === 0}
              onClick={applyBatchSelected}
              className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold ${
                batchSaving || selectedCount === 0
                  ? "cursor-not-allowed bg-white/10 text-white/45"
                  : "bg-white text-slate-950 hover:bg-white/90"
              }`}
            >
              {batchSaving ? "Application…" : "Appliquer"}
            </button>

            <div className="h-6 w-px bg-white/10" />

            {/* Quick actions on selection */}
            <button
              type="button"
              disabled={batchSaving || selectedCount === 0}
              onClick={quickVerified}
              className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
                batchSaving || selectedCount === 0
                  ? "cursor-not-allowed bg-emerald-400/10 text-emerald-50/40"
                  : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-50 hover:bg-emerald-400/15"
              }`}
            >
              ✅ Verified (1-clic)
            </button>

            <button
              type="button"
              disabled={batchSaving || selectedCount === 0}
              onClick={quickNeedsReview}
              className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
                batchSaving || selectedCount === 0
                  ? "cursor-not-allowed bg-amber-400/10 text-amber-50/40"
                  : "border border-amber-400/20 bg-amber-400/10 text-amber-50 hover:bg-amber-400/15"
              }`}
            >
              ⚠️ Needs review (1-clic)
            </button>

            <button
              type="button"
              disabled={batchSaving || selectedCount === 0}
              onClick={quickRejected}
              className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
                batchSaving || selectedCount === 0
                  ? "cursor-not-allowed bg-rose-400/10 text-rose-50/40"
                  : "border border-rose-400/25 bg-rose-400/10 text-rose-50 hover:bg-rose-400/15"
              }`}
            >
              ❌ Rejected (1-clic)
            </button>

            <div className="h-6 w-px bg-white/10" />
            <button
              type="button"
              disabled={batchSaving}
              onClick={quickPendingToNeedsReviewNoNote}
              className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
                batchSaving
                  ? "cursor-not-allowed bg-white/10 text-white/45"
                  : "border border-sky-400/20 bg-sky-400/10 text-sky-50 hover:bg-sky-400/15"
              }`}
            >
              ⚡ Pending → Needs review (no note)
            </button>

            <div className="h-6 w-px bg-white/10" />
            <button
              type="button"
              onClick={exportFilteredCsv}
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
              title="Exporte les résultats filtrés en CSV"
            >
              Export filtered CSV
            </button>

            <button
              type="button"
              onClick={exportSelectionCsv}
              disabled={selectedRows.length === 0}
              className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
                selectedRows.length === 0
                  ? "cursor-not-allowed bg-white/10 text-white/45"
                  : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
              title="Exporte la sélection en CSV"
            >
              Export selection CSV
            </button>

            <button
              type="button"
              onClick={copySummary}
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
              title="Copie un résumé admin (stats + blockers)"
            >
              Copy summary
            </button>

            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              className="ml-auto inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
            >
              {panelOpen ? "Hide details" : "Show details"}
            </button>
          </div>

          <div className="mt-2 text-[11px] text-white/45">
            Group actions: chaque coach a son mini batch (scope + status + note + apply).
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-white/55">
          Vue :{" "}
          <span className="text-white/80 font-semibold">
            {groupView ? "Groupée par coach" : "Table"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGroupView(true)}
            className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
              groupView ? "bg-white text-slate-950" : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
            }`}
          >
            Group view
          </button>
          <button
            type="button"
            onClick={() => setGroupView(false)}
            className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
              !groupView ? "bg-white text-slate-950" : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
            }`}
          >
            Table view
          </button>

          {groupView ? (
            <>
              <button
                type="button"
                onClick={expandAllGroups}
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={collapseAllGroups}
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
              >
                Collapse all
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ✅ GROUP VIEW */}
      {groupView ? (
        <div className="space-y-3">
          {groups.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/65">
              Aucun coach (groupé) ne correspond aux filtres.
            </div>
          ) : (
            groups.map((g) => {
              const open = expandedGroups.has(g.key);
              const slug = g.coachSlug;
              const title = getCoachLabel(g);

              const canSafeVerify = !!slug && g.blockers.length === 0;

              const op = getGroupOp(g.key);
              const idsCount = idsForScope(g.docs, op.scope).length;

              return (
                <div
                  key={g.key}
                  className="rounded-3xl border border-white/10 bg-black/20 p-4"
                >
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleGroupExpanded(g.key)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      title="Expand/collapse"
                    >
                      <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/70">
                        {open ? "−" : "+"}
                      </span>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {title}
                        </div>
                        <div className="mt-1 text-xs text-white/55">
                          docs: <span className="text-white/80 font-semibold">{g.docs.length}</span>
                          <span className="mx-2 text-white/25">•</span>
                          {formatCounts(g.counts)}
                        </div>
                      </div>
                    </button>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      {g.counts.pending > 0 ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${badgeClasses("pending")}`}>
                          pending {g.counts.pending}
                        </span>
                      ) : null}
                      {g.counts.needs_review > 0 ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${badgeClasses("needs_review")}`}>
                          needs_review {g.counts.needs_review}
                        </span>
                      ) : null}
                      {g.counts.verified > 0 ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${badgeClasses("verified")}`}>
                          verified {g.counts.verified}
                        </span>
                      ) : null}
                      {g.counts.rejected > 0 ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${badgeClasses("rejected")}`}>
                          rejected {g.counts.rejected}
                        </span>
                      ) : null}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {slug ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setCoachSlugPick(slug);
                              setPanelOpen(true);
                            }}
                            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                          >
                            Focus coach
                          </button>

                          <button
                            type="button"
                            onClick={() => filterToCoachSlug(slug)}
                            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                          >
                            Filter
                          </button>

                          <a
                            href={`/coachs/${slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                          >
                            Public ↗
                          </a>

                          <button
                            type="button"
                            onClick={() => selectCoachDocsReplace(slug)}
                            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                          >
                            Select docs
                          </button>

                          <button
                            type="button"
                            onClick={() => addCoachDocs(slug)}
                            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                          >
                            + selection
                          </button>

                          <button
                            type="button"
                            disabled={batchSaving || !canSafeVerify}
                            onClick={() => quickVerifySlugSafePlus(slug)}
                            className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
                              batchSaving || !canSafeVerify
                                ? "cursor-not-allowed bg-emerald-400/10 text-emerald-50/40"
                                : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-50 hover:bg-emerald-400/15"
                            }`}
                            title={
                              canSafeVerify
                                ? "SAFE+: Verify le coach (docs pending/needs_review uniquement)"
                                : "Bloqué (docs verified/rejected présents dans les filtres)"
                            }
                          >
                            ✅ Safe verify
                          </button>
                        </>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => exportCoachCsv(g.docs, g.key)}
                        className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                      >
                        Export CSV
                      </button>

                      {g.userId ? (
                        <button
                          type="button"
                          onClick={() => onCopy(g.userId ?? "", "userId")}
                          className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                        >
                          Copy userId
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* ✅ GROUP ACTIONS BAR */}
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs font-semibold text-white/70">
                        Group actions
                      </div>

                      <select
                        className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                        value={op.scope}
                        onChange={(e) => setGroupOp(g.key, { scope: e.target.value as GroupScope })}
                        title="Scope"
                      >
                        {GROUP_SCOPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>

                      <select
                        className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                        value={op.status}
                        onChange={(e) => setGroupOp(g.key, { status: e.target.value as Status })}
                        title="Status"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>

                      <input
                        className="min-w-[220px] flex-1 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-white/35"
                        placeholder="review_note (optionnel) — s’applique à tout le scope"
                        value={op.note}
                        onChange={(e) => setGroupOp(g.key, { note: e.target.value })}
                      />

                      <button
                        type="button"
                        disabled={batchSaving || idsCount === 0}
                        onClick={() => applyGroupOp(g)}
                        className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold ${
                          batchSaving || idsCount === 0
                            ? "cursor-not-allowed bg-white/10 text-white/45"
                            : "bg-white text-slate-950 hover:bg-white/90"
                        }`}
                        title={
                          idsCount === 0
                            ? "Aucun doc dans ce scope"
                            : `Appliquer sur ${idsCount} doc(s)`
                        }
                      >
                        Apply ({idsCount})
                      </button>

                      <button
                        type="button"
                        onClick={() => setGroupOp(g.key, DEFAULT_GROUP_OP)}
                        className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                        title="Reset group actions"
                      >
                        Reset
                      </button>
                    </div>

                    <div className="mt-2 text-[11px] text-white/45">
                      Scope “blockers” = docs {`{verified,rejected}`} (bloquants pour Safe verify).
                    </div>
                  </div>

                  {/* Blockers hint */}
                  {slug && g.blockers.length > 0 ? (
                    <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-50/90">
                      <span className="font-semibold">Bloqué pour safe verify</span> — blockers:{" "}
                      {Array.from(new Set(g.blockers.map((d) => normalizeStatus(d.status)))).join(", ")}{" "}
                      ({g.blockers.length})
                    </div>
                  ) : null}

                  {/* Content */}
                  {open ? (
                    <div className="mt-4 space-y-3">
                      {g.docs
                        .slice()
                        .sort((a, b) => {
                          const sa = normalizeStatus(a.status);
                          const sb = normalizeStatus(b.status);
                          const order: Record<Status, number> = {
                            rejected: 0,
                            verified: 1,
                            needs_review: 2,
                            pending: 3,
                          };
                          const d = (order[sa] ?? 99) - (order[sb] ?? 99);
                          if (d !== 0) return d;
                          return (a.createdAt ?? "") > (b.createdAt ?? "") ? -1 : 1;
                        })
                        .map((r) => {
                          const status = normalizeStatus(r.status);
                          const isFocused = inspectDocId === r.id;

                          return (
                            <div
                              key={r.id}
                              className={`rounded-2xl border border-white/10 bg-black/10 p-3 ${
                                isFocused ? "outline outline-1 outline-sky-400/40" : ""
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClasses(
                                        status,
                                      )}`}
                                    >
                                      {statusLabel(status)}
                                    </span>

                                    <div className="text-sm font-semibold text-white/85">
                                      {r.kind}
                                      {r.title ? (
                                        <span className="text-white/60"> — {r.title}</span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="mt-1 text-[11px] text-white/45">
                                    created: {safeDateLabel(r.createdAt)}
                                    <span className="mx-2 text-white/25">•</span>
                                    reviewed: {safeDateLabel(r.reviewedAt)}
                                    <span className="mx-2 text-white/25">•</span>
                                    reviewer: {r.reviewerEmail ?? r.reviewerId ?? "—"}
                                  </div>

                                  <div className="mt-1 text-[11px] text-white/45">
                                    docId: {r.id}
                                    <span className="mx-2 text-white/25">•</span>
                                    userId: {r.userId}
                                  </div>

                                  {r.reviewNote ? (
                                    <div className="mt-2 text-xs text-white/70">
                                      <span className="font-semibold text-white/80">Note:</span>{" "}
                                      {r.reviewNote}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInspectDocId(r.id);
                                      setPanelOpen(true);
                                      if (slug) setCoachSlugPick(slug);
                                    }}
                                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                                  >
                                    Focus
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onCopy(r.id, "docId")}
                                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                                  >
                                    Copy docId
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onCopy(r.userId, "userId")}
                                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                                  >
                                    Copy userId
                                  </button>

                                  <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center rounded-2xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-white/90"
                                  >
                                    Ouvrir ↗
                                  </a>
                                </div>
                              </div>

                              {/* Inline edit */}
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <select
                                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                                  value={status}
                                  onChange={(e) => {
                                    const v = normalizeStatus(e.target.value);
                                    setRows((prev) =>
                                      prev.map((x) => (x.id === r.id ? { ...x, status: v } : x)),
                                    );
                                  }}
                                >
                                  {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                      {statusLabel(s)}
                                    </option>
                                  ))}
                                </select>

                                <input
                                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-white/35"
                                  placeholder="review_note (optionnel)"
                                  value={r.reviewNote ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setRows((prev) =>
                                      prev.map((x) => (x.id === r.id ? { ...x, reviewNote: v } : x)),
                                    );
                                  }}
                                />
                              </div>

                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  disabled={savingId === r.id}
                                  onClick={() => saveRow(r.id)}
                                  className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold ${
                                    savingId === r.id
                                      ? "cursor-not-allowed bg-white/10 text-white/50"
                                      : "bg-white text-slate-950 hover:bg-white/90"
                                  }`}
                                >
                                  {savingId === r.id ? "Enregistrement…" : "Sauver"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {/* TABLE VIEW (garde si tu veux repasser en tableau) */}
      {!groupView ? (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs text-white/60">
                <th className="px-3 py-2">Sel</th>
                <th className="px-3 py-2">Coach</th>
                <th className="px-3 py-2">Doc</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2">Review</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => {
                const coachLabel = r.coachName ?? r.coachSlug ?? "—";
                const created = safeDateLabel(r.createdAt);
                const reviewed = safeDateLabel(r.reviewedAt);
                const isChecked = selected.has(r.id);
                const isFocused = inspectDocId === r.id;
                const status = normalizeStatus(r.status);

                return (
                  <tr
                    key={r.id}
                    className={`rounded-2xl border border-white/10 bg-black/20 align-top ${
                      isChecked ? "ring-1 ring-white/15" : ""
                    } ${isFocused ? "outline outline-1 outline-sky-400/40" : ""}`}
                  >
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={isChecked} onChange={() => toggleOne(r.id)} />
                    </td>

                    <td className="px-3 py-3">
                      <div className="text-sm font-semibold text-white">{coachLabel}</div>
                      <div className="mt-1 text-xs text-white/50">
                        user: {r.userId}
                        <span className="mx-2 text-white/25">•</span>
                        {created}
                      </div>
                      {r.coachSlug ? (
                        <div className="mt-1 text-xs text-white/50">slug: {r.coachSlug}</div>
                      ) : null}
                    </td>

                    <td className="px-3 py-3">
                      <div className="text-sm text-white/85">
                        <span className="font-semibold">{r.kind}</span>
                        {r.title ? <span className="text-white/60"> — {r.title}</span> : null}
                      </div>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-xs text-sky-200 underline underline-offset-2 hover:text-sky-100"
                      >
                        Ouvrir le fichier ↗
                      </a>
                    </td>

                    <td className="px-3 py-3">
                      <div className={`mb-2 inline-flex items-center rounded-full border px-2 py-1 text-[11px] ${badgeClasses(status)}`}>
                        {statusLabel(status)}
                      </div>

                      <select
                        className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                        value={status}
                        onChange={(e) => {
                          const v = normalizeStatus(e.target.value);
                          setRows((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, status: v } : x)),
                          );
                        }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-3">
                      <textarea
                        className="min-h-[44px] w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-white/35"
                        placeholder="review_note (optionnel)"
                        value={r.reviewNote ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, reviewNote: v } : x)),
                          );
                        }}
                      />
                    </td>

                    <td className="px-3 py-3 text-xs text-white/60">
                      <div>reviewed_at: {reviewed}</div>
                      <div className="mt-1">reviewer: {r.reviewerEmail ?? r.reviewerId ?? "—"}</div>
                    </td>

                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        disabled={savingId === r.id}
                        onClick={() => saveRow(r.id)}
                        className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold ${
                          savingId === r.id
                            ? "cursor-not-allowed bg-white/10 text-white/50"
                            : "bg-white text-slate-950 hover:bg-white/90"
                        }`}
                      >
                        {savingId === r.id ? "Enregistrement…" : "Sauver"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/60">
              Aucun document ne correspond aux filtres.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
