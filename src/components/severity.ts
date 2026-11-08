import type { Severity } from "@/lib/types";

export const SEVERITY_LABEL: Record<Severity, string> = {
  void: "Voids the lease",
  high: "High risk",
  review: "Review",
};

export const SEVERITY_BADGE: Record<Severity, string> = {
  void: "bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300",
  high: "bg-amber-100 text-amber-900 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300",
  review: "bg-sky-100 text-sky-900 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300",
};

export const SEVERITY_BORDER: Record<Severity, string> = {
  void: "border-l-red-500",
  high: "border-l-amber-500",
  review: "border-l-sky-500",
};

export const SEVERITY_MARK: Record<Severity, string> = {
  void: "bg-red-200/70 dark:bg-red-500/30",
  high: "bg-amber-200/70 dark:bg-amber-500/30",
  review: "bg-sky-200/70 dark:bg-sky-500/30",
};
