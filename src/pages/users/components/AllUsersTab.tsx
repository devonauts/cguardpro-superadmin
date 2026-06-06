import { useCallback, useEffect, useRef, useState } from "react";
import {
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
} from "@heroui/react";
import { Search } from "lucide-react";

import { DataState } from "@/components/ui/DataState";
import { usersService } from "@/services/users";
import { fmtDate, statusColor, billingStatusLabel } from "@/lib/format";
import type { Paginated, PlatformUserRow } from "@/types";

const PAGE_LIMIT = 25;

const COMPANY_OPTIONS = [
  { key: "", label: "Any company" },
  { key: "yes", label: "Has company" },
  { key: "no", label: "No company" },
];

const BILLING_OPTIONS = [
  { key: "", label: "Any billing" },
  { key: "active", label: "Active" },
  { key: "trialing", label: "Trial" },
  { key: "past_due", label: "Past due" },
  { key: "trial_expired", label: "Trial expired" },
  { key: "canceled", label: "Canceled" },
];

export function AllUsersTab() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [hasCompany, setHasCompany] = useState<"" | "yes" | "no">("");
  const [billing, setBilling] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<PlatformUserRow> | null>(null);
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
      const res = await usersService.platformUsers({
        search: search || undefined,
        hasCompany: hasCompany || undefined,
        billing: billing || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [search, hasCompany, billing, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [hasCompany, billing]);

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
          value={searchInput}
          onValueChange={setSearchInput}
          isClearable
          onClear={() => setSearchInput("")}
          startContent={<Search className="h-4 w-4 text-default-400" />}
        />
        <Select
          className="sm:max-w-[180px]"
          size="sm"
          label="Company"
          labelPlacement="outside"
          placeholder="Any company"
          selectedKeys={[hasCompany]}
          onSelectionChange={(keys) =>
            setHasCompany((Array.from(keys)[0] as "" | "yes" | "no") || "")
          }
        >
          {COMPANY_OPTIONS.map((o) => (
            <SelectItem key={o.key}>{o.label}</SelectItem>
          ))}
        </Select>
        <Select
          className="sm:max-w-[180px]"
          size="sm"
          label="Billing"
          labelPlacement="outside"
          placeholder="Any billing"
          selectedKeys={[billing]}
          onSelectionChange={(keys) => setBilling((Array.from(keys)[0] as string) || "")}
        >
          {BILLING_OPTIONS.map((o) => (
            <SelectItem key={o.key}>{o.label}</SelectItem>
          ))}
        </Select>
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={!rows.length}
        emptyLabel="No users match your filters."
        onRetry={load}
      >
        <Table aria-label="All platform users" isCompact removeWrapper>
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>EMAIL</TableColumn>
            <TableColumn>COMPANY</TableColumn>
            <TableColumn>ROLES</TableColumn>
            <TableColumn>BILL</TableColumn>
            <TableColumn>VERIFIED</TableColumn>
            <TableColumn>CREATED</TableColumn>
          </TableHeader>
          <TableBody items={rows}>
            {(u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <span>{u.fullName || "—"}</span>
                    {u.isSuperadmin && (
                      <Chip size="sm" variant="flat" color="secondary">
                        Superadmin
                      </Chip>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-default-500">{u.email || "—"}</TableCell>
                <TableCell>
                  {u.companyCount === 0 ? (
                    <Chip size="sm" variant="flat" color="default">
                      No company
                    </Chip>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-foreground">{u.primaryCompany}</span>
                      {u.companyCount > 1 && (
                        <Chip size="sm" variant="flat">
                          +{u.companyCount - 1}
                        </Chip>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.companies[0]?.roles?.length ? (
                      u.companies[0].roles.map((r) => (
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
                  {u.billPaid === true ? (
                    <Chip size="sm" variant="flat" color="success">
                      Paid
                    </Chip>
                  ) : u.billPaid === false ? (
                    <Chip size="sm" variant="flat" color={statusColor(u.billingStatus)}>
                      {billingStatusLabel(u.billingStatus)}
                    </Chip>
                  ) : (
                    <Chip size="sm" variant="flat" color="default">
                      —
                    </Chip>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={u.emailVerified ? "success" : "default"}
                  >
                    {u.emailVerified ? "Verified" : "Unverified"}
                  </Chip>
                </TableCell>
                <TableCell className="text-default-500">{fmtDate(u.createdAt)}</TableCell>
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
