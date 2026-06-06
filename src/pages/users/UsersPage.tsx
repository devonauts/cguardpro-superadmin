import { useCallback, useEffect, useState } from "react";
import {
  Tabs,
  Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Input,
  Select,
  SelectItem,
  Pagination,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  useDisclosure,
} from "@heroui/react";
import { Globe, Search, Shield, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { usersService } from "@/services/users";
import { fmtDate, statusColor } from "@/lib/format";
import type { Paginated, UserRow, GuardRow } from "@/types";
import { RowActions } from "./components/RowActions";
import { AllUsersTab } from "./components/AllUsersTab";

const PAGE_LIMIT = 25;

const STATUS_OPTIONS = [
  { key: "active", label: "Active" },
  { key: "invited", label: "Invited" },
  { key: "pending", label: "Pending" },
  { key: "archived", label: "Archived" },
];

// ── Staff tab ────────────────────────────────────────────────────────────────
function StaffTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<UserRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pending status change for the confirm modal.
  const [pending, setPending] = useState<{ user: UserRow; next: "archived" | "active" } | null>(
    null,
  );
  const [working, setWorking] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersService.list({
        search: search.trim() || undefined,
        status: status || undefined,
        role: role.trim() || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [search, status, role, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [search, status, role]);

  function requestChange(user: UserRow, next: "archived" | "active") {
    setPending({ user, next });
    onOpen();
  }

  async function confirmChange() {
    if (!pending) return;
    setWorking(true);
    try {
      await usersService.setStatus(pending.user.id, pending.next);
      toast.success(
        pending.next === "archived"
          ? `Archived ${pending.user.fullName || pending.user.email}`
          : `Reactivated ${pending.user.fullName || pending.user.email}`,
      );
      onClose();
      setPending(null);
      await load();
    } catch {
      // The api interceptor already surfaces a toast for the failure.
    } finally {
      setWorking(false);
    }
  }

  const rows = data?.rows ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          className="sm:max-w-xs"
          size="sm"
          label="Search"
          labelPlacement="outside"
          placeholder="Name or email…"
          value={search}
          onValueChange={setSearch}
          isClearable
          onClear={() => setSearch("")}
          startContent={<Search className="h-4 w-4 text-default-400" />}
        />
        <Select
          className="sm:max-w-[180px]"
          size="sm"
          label="Status"
          labelPlacement="outside"
          placeholder="All statuses"
          selectedKeys={status ? [status] : []}
          onSelectionChange={(keys) => setStatus((Array.from(keys)[0] as string) || "")}
        >
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.key}>{o.label}</SelectItem>
          ))}
        </Select>
        <Input
          className="sm:max-w-[180px]"
          size="sm"
          label="Role"
          labelPlacement="outside"
          placeholder="Filter by role…"
          value={role}
          onValueChange={setRole}
          isClearable
          onClear={() => setRole("")}
        />
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={!rows.length}
        emptyLabel="No staff users match your filters."
        onRetry={load}
      >
        <Table aria-label="Staff users" isCompact removeWrapper>
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>EMAIL</TableColumn>
            <TableColumn>TENANT</TableColumn>
            <TableColumn>ROLES</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn>CREATED</TableColumn>
            <TableColumn aria-label="Actions" align="end">
              {""}
            </TableColumn>
          </TableHeader>
          <TableBody items={rows}>
            {(u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-foreground">
                  {u.fullName || "—"}
                </TableCell>
                <TableCell className="text-default-500">{u.email || "—"}</TableCell>
                <TableCell className="text-default-500">{u.tenantName || "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roles?.length ? (
                      u.roles.map((r) => (
                        <Chip key={r} size="sm" variant="flat" className="capitalize">
                          {r}
                        </Chip>
                      ))
                    ) : (
                      <span className="text-default-400">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={statusColor(u.status)}
                    className="capitalize"
                  >
                    {u.status}
                  </Chip>
                </TableCell>
                <TableCell className="text-default-500">{fmtDate(u.createdAt)}</TableCell>
                <TableCell>
                  <RowActions
                    status={u.status}
                    onArchive={() => requestChange(u, "archived")}
                    onReactivate={() => requestChange(u, "active")}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {data && data.totalPages > 1 && (
          <div className="flex justify-center pt-2">
            <Pagination
              total={data.totalPages}
              page={page}
              onChange={setPage}
              showControls
              size="sm"
            />
          </div>
        )}
      </DataState>

      <Modal isOpen={isOpen} onClose={onClose} size="sm" backdrop="blur">
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>
                {pending?.next === "archived" ? "Archive user" : "Reactivate user"}
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-500">
                  {pending?.next === "archived" ? (
                    <>
                      Archive{" "}
                      <span className="font-medium text-foreground">
                        {pending?.user.fullName || pending?.user.email}
                      </span>{" "}
                      in tenant{" "}
                      <span className="font-medium text-foreground">
                        {pending?.user.tenantName}
                      </span>
                      ? They will lose access until reactivated.
                    </>
                  ) : (
                    <>
                      Reactivate{" "}
                      <span className="font-medium text-foreground">
                        {pending?.user.fullName || pending?.user.email}
                      </span>{" "}
                      in tenant{" "}
                      <span className="font-medium text-foreground">
                        {pending?.user.tenantName}
                      </span>
                      ?
                    </>
                  )}
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={close} isDisabled={working}>
                  Cancel
                </Button>
                <Button
                  color={pending?.next === "archived" ? "danger" : "success"}
                  onPress={confirmChange}
                  isLoading={working}
                >
                  {pending?.next === "archived" ? "Archive" : "Reactivate"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

// ── Guards tab ───────────────────────────────────────────────────────────────
function GuardsTab() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<GuardRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersService.guards({
        search: search.trim() || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load guards.");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const rows = data?.rows ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          className="sm:max-w-xs"
          size="sm"
          label="Search"
          labelPlacement="outside"
          placeholder="Name or government ID…"
          value={search}
          onValueChange={setSearch}
          isClearable
          onClear={() => setSearch("")}
          startContent={<Search className="h-4 w-4 text-default-400" />}
        />
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={!rows.length}
        emptyLabel="No guards match your search."
        onRetry={load}
      >
        <Table aria-label="Security guards" isCompact removeWrapper>
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>GOVERNMENT ID</TableColumn>
            <TableColumn>TENANT</TableColumn>
            <TableColumn>TYPE</TableColumn>
            <TableColumn>ON DUTY</TableColumn>
            <TableColumn>CREATED</TableColumn>
          </TableHeader>
          <TableBody items={rows}>
            {(g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium text-foreground">
                  {g.fullName || "—"}
                </TableCell>
                <TableCell className="text-default-500">{g.governmentId || "—"}</TableCell>
                <TableCell className="text-default-500">{g.tenantName || "—"}</TableCell>
                <TableCell className="text-default-500 capitalize">
                  {g.guardType || "—"}
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={g.isOnDuty ? "success" : "default"}
                  >
                    {g.isOnDuty ? "On duty" : "Off duty"}
                  </Chip>
                </TableCell>
                <TableCell className="text-default-500">{fmtDate(g.createdAt)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {data && data.totalPages > 1 && (
          <div className="flex justify-center pt-2">
            <Pagination
              total={data.totalPages}
              page={page}
              onChange={setPage}
              showControls
              size="sm"
            />
          </div>
        )}
      </DataState>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  return (
    <div>
      <PageHeader title="Users" subtitle="Every platform user, tenant members & guards" />
      <Tabs aria-label="Users tabs" variant="underlined" color="primary">
        <Tab
          key="all"
          title={
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span>All users</span>
            </div>
          }
        >
          <AllUsersTab />
        </Tab>
        <Tab
          key="members"
          title={
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              <span>Tenant members</span>
            </div>
          }
        >
          <StaffTab />
        </Tab>
        <Tab
          key="guards"
          title={
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Guards</span>
            </div>
          }
        >
          <GuardsTab />
        </Tab>
      </Tabs>
    </div>
  );
}
