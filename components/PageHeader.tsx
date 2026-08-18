import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PageHeader({
  title,
  subtitle,
  action,
  backHref,
  backLabel = "Vissza a főmenübe",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Optional — when set, renders a small "back to X" link above the title. */
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-forest"
          >
            <ArrowLeft size={14} /> {backLabel}
          </Link>
        )}
        <h1 className="font-serif text-2xl font-medium text-forest sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
