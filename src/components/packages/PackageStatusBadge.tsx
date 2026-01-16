import { PackageStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/packageConstants";
import { cn } from "@/lib/utils";

interface PackageStatusBadgeProps {
  status: PackageStatus;
  className?: string;
}

export function PackageStatusBadge({ status, className }: PackageStatusBadgeProps) {
  const colors = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        colors.bg,
        colors.text,
        colors.border,
        className
      )}
    >
      {label}
    </span>
  );
}
