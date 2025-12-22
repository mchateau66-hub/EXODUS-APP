// src/components/coach/CoachVerificationBadge.tsx
import * as React from "react";
import { coachVerificationCopy, type CoachVerificationStatus } from "@/lib/coachVerification";

type Props = {
  status: CoachVerificationStatus;
  className?: string;
};

function getClasses(status: CoachVerificationStatus): string {
  switch (status) {
    case "verified":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "needs_review":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "missing":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

function getDotColor(status: CoachVerificationStatus): string {
  switch (status) {
    case "verified":
      return "bg-emerald-600";
    case "needs_review":
      return "bg-amber-600";
    case "missing":
      return "bg-slate-500";
    case "rejected":
      return "bg-rose-600";
    default:
      return "bg-slate-400";
  }
}

export function CoachVerificationBadge({ status, className }: Props) {
  const { label, hint } = coachVerificationCopy(status);
  const cls = getClasses(status);
  const dot = getDotColor(status);

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[10px] font-medium",
        cls,
        className ?? "",
      ].join(" ")}
      title={hint}
      aria-label={hint ? `${label} — ${hint}` : label}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

export default CoachVerificationBadge;
