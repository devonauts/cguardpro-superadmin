import { useCallback, useEffect, useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  Pagination,
  useDisclosure,
} from "@heroui/react";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { trainingService } from "@/services/training";
import { fmtDate, usdFromDollars, statusColor } from "@/lib/format";
import type { AddonCourse, AddonCourseGrant } from "@/types";
import { GrantAddonModal } from "./components/GrantAddonModal";

const PAGE_LIMIT = 25;

export default function GrantsPage() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AddonCourseGrant[]>([]);
  const [count, setCount] = useState(0);
  const [courses, setCourses] = useState<AddonCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const grant = useDisclosure();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [grantsRes, coursesRes] = await Promise.all([
        trainingService.listGrants({ page, limit: PAGE_LIMIT }),
        trainingService.listCourses({ limit: 200, page: 1 }),
      ]);
      setRows(grantsRes.rows);
      setCount(grantsRes.count);
      setCourses(coursesRes.rows);
    } catch (e: any) {
      setError(e?.message || "Failed to load grants.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_LIMIT));

  function seatsLabel(g: AddonCourseGrant): string {
    if (g.seatCount == null) return `${g.currentEnrollments} / ∞`;
    return `${g.currentEnrollments} / ${g.seatCount}`;
  }

  return (
    <div>
      <PageHeader
        title="Course grants"
        subtitle="Which tenants have access to which platform addon courses"
        actions={
          <Button
            color="primary"
            startContent={<Plus className="h-4 w-4" />}
            onPress={grant.onOpen}
            isDisabled={!courses.length}
          >
            Grant course
          </Button>
        }
      />

      <DataState
        loading={loading}
        error={error}
        empty={!rows.length}
        emptyLabel="No grants yet. Grant an addon course to a tenant to get started."
        onRetry={load}
      >
        <Table aria-label="Course grants" isCompact removeWrapper>
          <TableHeader>
            <TableColumn>COURSE</TableColumn>
            <TableColumn>TENANT</TableColumn>
            <TableColumn>SEATS USED</TableColumn>
            <TableColumn>PRICE PAID</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn>EXPIRES</TableColumn>
          </TableHeader>
          <TableBody items={rows}>
            {(g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium text-foreground">
                  {g.courseTitle || "—"}
                </TableCell>
                <TableCell className="text-default-500">
                  {g.tenantName || "—"}
                </TableCell>
                <TableCell className="text-default-500">{seatsLabel(g)}</TableCell>
                <TableCell className="text-default-500">
                  {g.pricePaid != null ? usdFromDollars(g.pricePaid) : "—"}
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={statusColor(g.status)}
                    className="capitalize"
                  >
                    {g.status}
                  </Chip>
                </TableCell>
                <TableCell className="text-default-500">
                  {g.expiresAt ? fmtDate(g.expiresAt) : "Never"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex justify-center pt-3">
            <Pagination
              total={totalPages}
              page={page}
              onChange={setPage}
              showControls
              size="sm"
            />
          </div>
        )}
      </DataState>

      <GrantAddonModal
        isOpen={grant.isOpen}
        onClose={grant.onClose}
        onGranted={() => {
          grant.onClose();
          setPage(1);
          load();
        }}
        courses={courses}
      />
    </div>
  );
}
