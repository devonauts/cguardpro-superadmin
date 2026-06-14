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
import { GraduationCap, Plus, Gift } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { trainingService } from "@/services/training";
import { fmtDate, usdFromDollars } from "@/lib/format";
import type { AddonCourse } from "@/types";
import { categoryLabel, levelLabel } from "./constants";
import { CreateAddonCourseModal } from "./components/CreateAddonCourseModal";
import { GrantAddonModal } from "./components/GrantAddonModal";

const PAGE_LIMIT = 25;

export default function AddonCoursesPage() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AddonCourse[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const create = useDisclosure();
  const grant = useDisclosure();
  const [grantCourseId, setGrantCourseId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await trainingService.listCourses({ page, limit: PAGE_LIMIT });
      setRows(res.rows);
      setCount(res.count);
    } catch (e: any) {
      setError(e?.message || "Failed to load addon courses.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_LIMIT));

  function openGrant(courseId: string) {
    setGrantCourseId(courseId);
    grant.onOpen();
  }

  return (
    <div>
      <PageHeader
        title="Addon courses"
        subtitle="Platform-wide training catalog you can grant or sell to tenants"
        actions={
          <Button
            color="primary"
            startContent={<Plus className="h-4 w-4" />}
            onPress={create.onOpen}
          >
            New course
          </Button>
        }
      />

      <DataState
        loading={loading}
        error={error}
        empty={!rows.length}
        emptyLabel="No addon courses yet. Create one to build the platform catalog."
        onRetry={load}
      >
        <Table aria-label="Addon courses" isCompact removeWrapper>
          <TableHeader>
            <TableColumn>TITLE</TableColumn>
            <TableColumn>CATEGORY</TableColumn>
            <TableColumn>LEVEL</TableColumn>
            <TableColumn>POINTS</TableColumn>
            <TableColumn>PRICE</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn>CREATED</TableColumn>
            <TableColumn aria-label="Actions" align="end">
              {""}
            </TableColumn>
          </TableHeader>
          <TableBody items={rows}>
            {(c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-default-400" />
                    <span className="font-medium text-foreground">{c.title}</span>
                  </div>
                </TableCell>
                <TableCell className="text-default-500">
                  {categoryLabel(c.category)}
                </TableCell>
                <TableCell className="text-default-500">
                  {levelLabel(c.level)}
                </TableCell>
                <TableCell className="text-default-500">{c.pointsValue}</TableCell>
                <TableCell className="text-default-500">
                  {c.addonPrice != null ? usdFromDollars(c.addonPrice) : "Free"}
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={c.published ? "success" : "default"}
                  >
                    {c.published ? "Published" : "Draft"}
                  </Chip>
                </TableCell>
                <TableCell className="text-default-500">
                  {fmtDate(c.createdAt)}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={<Gift className="h-3.5 w-3.5" />}
                    onPress={() => openGrant(c.id)}
                  >
                    Grant
                  </Button>
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

      <CreateAddonCourseModal
        isOpen={create.isOpen}
        onClose={create.onClose}
        onCreated={() => {
          create.onClose();
          setPage(1);
          load();
        }}
      />

      <GrantAddonModal
        isOpen={grant.isOpen}
        onClose={grant.onClose}
        onGranted={() => {
          grant.onClose();
          setGrantCourseId(null);
        }}
        courses={rows}
        presetCourseId={grantCourseId}
      />
    </div>
  );
}
