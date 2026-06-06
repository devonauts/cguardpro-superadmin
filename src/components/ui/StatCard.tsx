import { ReactNode } from "react";
import { Card, CardBody, Skeleton } from "@heroui/react";

/** A KPI tile: label, big value, optional icon and sub-text. */
export function StatCard({
  label,
  value,
  icon,
  sub,
  loading,
  accent = "default",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  sub?: ReactNode;
  loading?: boolean;
  accent?: "default" | "primary" | "success" | "warning" | "danger";
}) {
  const accentRing: Record<string, string> = {
    default: "",
    primary: "ring-1 ring-primary/30",
    success: "ring-1 ring-success/30",
    warning: "ring-1 ring-warning/30",
    danger: "ring-1 ring-danger/30",
  };
  return (
    <Card className={`shadow-sm ${accentRing[accent]}`}>
      <CardBody className="gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-default-500">
            {label}
          </span>
          {icon && <span className="text-default-400">{icon}</span>}
        </div>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-24 rounded-md" />
        ) : (
          <span className="text-2xl font-semibold text-foreground">{value}</span>
        )}
        {sub && !loading && (
          <span className="text-xs text-default-500">{sub}</span>
        )}
      </CardBody>
    </Card>
  );
}

export default StatCard;
