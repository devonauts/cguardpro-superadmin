import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardBody,
  Chip,
  Button,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Tooltip,
  useDisclosure,
} from "@heroui/react";
import { Search, RefreshCw, X, Eye } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { observabilityService } from "@/services/observability";
import { fmtDateTime } from "@/lib/format";
import type { AuditEntry, Paginated } from "@/types";
import { AuditDetailsModal } from "./components/AuditDetailsModal";

const COMMON_ACTIONS = [
  "tenant.create",
  "tenant.update",
  "tenant.suspend",
  "tenant.reactivate",
  "tenant.delete",
  "user.setStatus",
];

function statusCodeColor(code: number | null): "success" | "warning" | "danger" | "default" {
  if (code == null) return "default";
  if (code >= 200 && code < 300) return "success";
  if (code >= 500) return "danger";
  if (code >= 400) return "warning";
  return "default";
}

export default function AuditLogPage() {
  const [data, setData] = useState<Paginated<AuditEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters (committed values used for fetching).
  const [action, setAction] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await observabilityService.audit({
        action: action || undefined,
        tenantId: tenantId || undefined,
        actorUserId: actorUserId || undefined,
        page,
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  }, [action, tenantId, actorUserId, page]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFilters = !!(action || tenantId || actorUserId);

  const resetFilters = () => {
    setAction("");
    setTenantId("");
    setActorUserId("");
    setPage(1);
  };

  const openDetails = (entry: AuditEntry) => {
    setSelected(entry);
    onOpen();
  };

  const rows = data?.rows ?? [];

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Every action taken in this panel"
        actions={
          <Button
            size="sm"
            variant="flat"
            color="primary"
            startContent={<RefreshCw className="h-4 w-4" />}
            onPress={load}
          >
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-4 shadow-sm">
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Action"
            size="sm"
            labelPlacement="outside"
            placeholder="All actions"
            selectedKeys={action ? [action] : []}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            {COMMON_ACTIONS.map((a) => (
              <SelectItem key={a}>{a}</SelectItem>
            ))}
          </Select>
          <Input
            label="Tenant ID"
            size="sm"
            labelPlacement="outside"
            placeholder="Filter by tenant"
            value={tenantId}
            onValueChange={(v) => {
              setTenantId(v);
              setPage(1);
            }}
            startContent={<Search className="h-4 w-4 text-default-400" />}
            isClearable
            onClear={() => {
              setTenantId("");
              setPage(1);
            }}
          />
          <Input
            label="Actor user ID"
            size="sm"
            labelPlacement="outside"
            placeholder="Filter by actor"
            value={actorUserId}
            onValueChange={(v) => {
              setActorUserId(v);
              setPage(1);
            }}
            startContent={<Search className="h-4 w-4 text-default-400" />}
            isClearable
            onClear={() => {
              setActorUserId("");
              setPage(1);
            }}
          />
          <div className="flex items-end">
            <Button
              size="sm"
              variant="flat"
              isDisabled={!hasFilters}
              startContent={<X className="h-4 w-4" />}
              onPress={resetFilters}
            >
              Clear filters
            </Button>
          </div>
        </CardBody>
      </Card>

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && rows.length === 0}
        emptyLabel={hasFilters ? "No entries match these filters." : "No audit entries yet."}
        onRetry={load}
      >
        {data && rows.length > 0 && (
          <Card className="shadow-sm">
            <CardBody className="pt-2">
              <Table
                removeWrapper
                aria-label="Audit log"
                selectionMode="none"
                classNames={{
                  th: "bg-transparent text-default-500 text-xs uppercase tracking-wide",
                  td: "py-3 align-top",
                }}
              >
                <TableHeader>
                  <TableColumn>TIME</TableColumn>
                  <TableColumn>ACTOR</TableColumn>
                  <TableColumn>ACTION</TableColumn>
                  <TableColumn>TARGET</TableColumn>
                  <TableColumn>TENANT</TableColumn>
                  <TableColumn>REQUEST</TableColumn>
                  <TableColumn className="text-center">STATUS</TableColumn>
                  <TableColumn className="text-right">DETAILS</TableColumn>
                </TableHeader>
                <TableBody>
                  {rows.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer transition-colors hover:bg-default-100"
                      onClick={() => openDetails(entry)}
                    >
                      <TableCell className="whitespace-nowrap text-default-500">
                        {fmtDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {entry.actorEmail || (
                          <span className="text-default-400">system</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat" color="secondary">
                          {entry.action}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        {entry.targetType ? (
                          <div className="flex flex-col">
                            <span className="text-foreground">{entry.targetType}</span>
                            {entry.targetId && (
                              <span className="max-w-[16ch] truncate text-xs text-default-400">
                                {entry.targetId}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-default-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.tenantId ? (
                          <span className="max-w-[16ch] truncate font-mono text-xs text-default-500">
                            {entry.tenantId}
                          </span>
                        ) : (
                          <span className="text-default-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.method || entry.path ? (
                          <span className="font-mono text-xs text-default-500">
                            <span className="font-semibold text-default-600">{entry.method}</span>{" "}
                            {entry.path}
                          </span>
                        ) : (
                          <span className="text-default-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.statusCode != null ? (
                          <Chip size="sm" variant="flat" color={statusCodeColor(entry.statusCode)}>
                            {entry.statusCode}
                          </Chip>
                        ) : (
                          <span className="text-default-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip content="View details">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            aria-label="View audit details"
                            onPress={() => openDetails(entry)}
                          >
                            <Eye className="h-4 w-4 text-default-500" />
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data.totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-4">
                  <span className="text-xs text-default-400">
                    {data.count.toLocaleString("en-US")} entries
                  </span>
                  <Pagination
                    showControls
                    size="sm"
                    color="primary"
                    page={page}
                    total={data.totalPages}
                    onChange={setPage}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </DataState>

      <AuditDetailsModal entry={selected} isOpen={isOpen} onClose={onClose} />
    </div>
  );
}
