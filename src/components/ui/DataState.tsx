import { ReactNode } from "react";
import { Spinner, Button } from "@heroui/react";
import { AlertTriangle, Inbox } from "lucide-react";

/**
 * Wraps async content with consistent loading / error / empty states.
 * Usage: <DataState loading={l} error={e} empty={!rows.length} onRetry={refetch}>…</DataState>
 */
export function DataState({
  loading,
  error,
  empty,
  emptyLabel = "Nothing here yet.",
  onRetry,
  children,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyLabel?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner color="primary" label="Loading…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-danger" />
        <p className="text-sm text-default-500">{error}</p>
        {onRetry && (
          <Button size="sm" variant="flat" color="primary" onPress={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center text-default-400">
        <Inbox className="h-8 w-8" />
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default DataState;
