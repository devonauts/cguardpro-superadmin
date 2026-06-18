import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Card,
  CardBody,
  Chip,
  Button,
  Input,
  Select,
  SelectItem,
  Pagination,
  useDisclosure,
} from "@heroui/react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { tenantsService } from "@/services/tenants";
import type { Paginated, TenantRow, TenantDetail } from "@/types";
import {
  usd,
  fmtDate,
  statusColor,
  billingStatusLabel,
} from "@/lib/format";
import { CreateTenantModal } from "./components/CreateTenantModal";
import { DeleteTenantModal } from "./components/DeleteTenantModal";
import { TenantRowActions } from "./components/TenantRowActions";

const LIMIT = 20;

const PLAN_OPTIONS = [
  { key: "", label: "All plans" },
  { key: "free", label: "Free" },
  { key: "growth", label: "Growth" },
  { key: "enterprise", label: "Enterprise" },
];

const BILLING_OPTIONS = [
  { key: "", label: "All statuses" },
  { key: "trialing", label: "Trial" },
  { key: "active", label: "Active" },
  { key: "past_due", label: "Past due" },
  { key: "trial_expired", label: "Trial expired" },
  { key: "canceled", label: "Canceled" },
];

export default function TenantsList() {
  const navigate = useNavigate();
  const createModal = useDisclosure();
  const deleteModal = useDisclosure();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("");
  const [billingStatus, setBillingStatus] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<TenantRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search input.
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await tenantsService.list({
        search: search || undefined,
        plan: plan || undefined,
        billingStatus: billingStatus || undefined,
        page,
        limit: LIMIT,
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, [search, plan, billingStatus, page]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;

  const onCreated = (tenant: TenantDetail) => {
    createModal.onClose();
    load();
    navigate(`/tenants/${tenant.id}`);
  };

  const reactivate = async (t: TenantRow) => {
    try {
      await tenantsService.reactivate(t.id);
      toast.success(`Tenant “${t.name}” reactivated`);
      load();
    } catch {
      /* error toast handled by the api interceptor */
    }
  };

  const subtitle = useMemo(
    () => (data ? `${data.count} total` : undefined),
    [data],
  );

  return (
    <div>
      <PageHeader
        title="Tenants"
        subtitle={subtitle}
        actions={
          <Button
            color="primary"
            startContent={<Plus className="h-4 w-4" />}
            onPress={createModal.onOpen}
          >
            New tenant
          </Button>
        }
      />

      <Card className="mb-4 shadow-sm">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            className="sm:max-w-xs"
            placeholder="Search name, email or URL…"
            value={searchInput}
            onValueChange={setSearchInput}
            isClearable
            onClear={() => setSearchInput("")}
            startContent={<Search className="h-4 w-4 text-default-400" />}
            variant="bordered"
            size="sm"
          />
          <Select
            className="sm:max-w-[180px]"
            aria-label="Filter by plan"
            size="sm"
            variant="bordered"
            selectedKeys={[plan]}
            onChange={(e) => {
              setPlan(e.target.value);
              setPage(1);
            }}
          >
            {PLAN_OPTIONS.map((o) => (
              <SelectItem key={o.key}>{o.label}</SelectItem>
            ))}
          </Select>
          <Select
            className="sm:max-w-[200px]"
            aria-label="Filter by billing status"
            size="sm"
            variant="bordered"
            selectedKeys={[billingStatus]}
            onChange={(e) => {
              setBillingStatus(e.target.value);
              setPage(1);
            }}
          >
            {BILLING_OPTIONS.map((o) => (
              <SelectItem key={o.key}>{o.label}</SelectItem>
            ))}
          </Select>
        </CardBody>
      </Card>

      <DataState
        loading={loading}
        error={error}
        empty={!loading && rows.length === 0}
        emptyLabel="No tenants match these filters."
        onRetry={load}
      >
        <Card className="shadow-sm">
          <CardBody className="p-0">
            <Table
              aria-label="Tenants"
              removeWrapper
              bottomContent={
                totalPages > 1 ? (
                  <div className="flex justify-center py-3">
                    <Pagination
                      showControls
                      size="sm"
                      page={page}
                      total={totalPages}
                      onChange={setPage}
                    />
                  </div>
                ) : null
              }
            >
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                <TableColumn>URL</TableColumn>
                <TableColumn>PLAN</TableColumn>
                <TableColumn>BILLING</TableColumn>
                <TableColumn>SEATS</TableColumn>
                <TableColumn>MRR</TableColumn>
                <TableColumn>CREATED</TableColumn>
                <TableColumn aria-label="Actions" align="end">
                  {" "}
                </TableColumn>
              </TableHeader>
              <TableBody items={rows} emptyContent="No tenants.">
                {(t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        to={`/tenants/${t.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {t.name}
                      </Link>
                      {t.email && (
                        <div className="text-xs text-default-400">
                          {t.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-default-500">
                        {t.url || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" className="capitalize">
                        {t.plan || "—"}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {t.suspendedAt ? (
                        <Chip size="sm" variant="flat" color="danger">
                          Suspended
                        </Chip>
                      ) : (
                        <Chip
                          size="sm"
                          variant="flat"
                          color={statusColor(t.billingStatus)}
                        >
                          {billingStatusLabel(t.billingStatus)}
                        </Chip>
                      )}
                    </TableCell>
                    <TableCell>{t.seats}</TableCell>
                    <TableCell className="font-medium">
                      {usd(t.mrrCents)}
                    </TableCell>
                    <TableCell className="text-sm text-default-500">
                      {fmtDate(t.createdAt)}
                    </TableCell>
                    <TableCell>
                      <TenantRowActions
                        suspended={!!t.suspendedAt}
                        onView={() => navigate(`/tenants/${t.id}`)}
                        onReactivate={() => reactivate(t)}
                        onDelete={() => {
                          setDeleteTarget({ id: t.id, name: t.name });
                          deleteModal.onOpen();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </DataState>

      <CreateTenantModal
        isOpen={createModal.isOpen}
        onClose={createModal.onClose}
        onCreated={onCreated}
      />

      <DeleteTenantModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.onClose}
        tenant={deleteTarget}
        onDeleted={() => {
          // If we just removed the last row on a page, step back a page.
          if (rows.length === 1 && page > 1) setPage(page - 1);
          else load();
        }}
      />
    </div>
  );
}
