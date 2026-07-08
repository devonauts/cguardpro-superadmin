import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Card, CardBody, Chip, Input, Select, SelectItem, Pagination,
} from "@heroui/react";
import { Search, Star } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { feedbackService, type FeedbackList as FeedbackListData } from "@/services/feedback";
import { fmtDate } from "@/lib/format";

const LIMIT = 20;

const RATING_OPTIONS = [
  { key: "", label: "Todas las estrellas" },
  { key: "5", label: "5 ★" },
  { key: "4", label: "4 ★" },
  { key: "3", label: "3 ★" },
  { key: "2", label: "2 ★" },
  { key: "1", label: "1 ★" },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= n ? "fill-amber-400 text-amber-400" : "text-default-300"}`} />
      ))}
    </span>
  );
}

export default function FeedbackList() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<FeedbackListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceRef.current = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await feedbackService.list({
        search: search || undefined,
        rating: rating ? Number(rating) : undefined,
        page,
        limit: LIMIT,
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el feedback");
    } finally {
      setLoading(false);
    }
  }, [search, rating, page]);

  useEffect(() => { load(); }, [load]);

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;
  const summary = data?.summary;
  const subtitle = useMemo(() => (data ? `${data.count} calificaciones` : undefined), [data]);

  return (
    <div>
      <PageHeader title="App Feedback" subtitle={subtitle} />

      {summary && summary.total > 0 && (
        <Card className="mb-4 shadow-sm">
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-amber-500">{summary.avg.toFixed(1)}</span>
              <div>
                <Stars n={Math.round(summary.avg)} />
                <div className="text-xs text-default-400">{summary.total} calificaciones</div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1 sm:max-w-md">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = summary.distribution[String(n)] || 0;
                const pct = summary.total ? Math.round((c / summary.total) * 100) : 0;
                return (
                  <div key={n} className="flex items-center gap-2 text-xs">
                    <span className="w-6 text-right text-default-500">{n}★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-default-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-default-400">{c}</span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="mb-4 shadow-sm">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            className="sm:max-w-xs"
            placeholder="Buscar en comentarios…"
            value={searchInput}
            onValueChange={setSearchInput}
            isClearable
            onClear={() => setSearchInput("")}
            startContent={<Search className="h-4 w-4 text-default-400" />}
            variant="bordered"
            size="sm"
          />
          <Select
            className="sm:max-w-[200px]"
            aria-label="Filtrar por estrellas"
            size="sm"
            variant="bordered"
            selectedKeys={[rating]}
            onChange={(e) => { setRating(e.target.value); setPage(1); }}
          >
            {RATING_OPTIONS.map((o) => <SelectItem key={o.key}>{o.label}</SelectItem>)}
          </Select>
        </CardBody>
      </Card>

      <DataState
        loading={loading}
        error={error}
        empty={!loading && rows.length === 0}
        emptyLabel="Aún no hay calificaciones."
        onRetry={load}
      >
        <Card className="shadow-sm">
          <CardBody className="p-0">
            <div className="overflow-x-auto">
            <Table
              aria-label="App feedback"
              removeWrapper
              bottomContent={totalPages > 1 ? (
                <div className="flex justify-center py-3">
                  <Pagination showControls size="sm" page={page} total={totalPages} onChange={setPage} />
                </div>
              ) : null}
            >
              <TableHeader>
                <TableColumn>CALIFICACIÓN</TableColumn>
                <TableColumn>EMPRESA</TableColumn>
                <TableColumn>USUARIO</TableColumn>
                <TableColumn>COMENTARIO</TableColumn>
                <TableColumn>ORIGEN</TableColumn>
                <TableColumn>FECHA</TableColumn>
              </TableHeader>
              <TableBody items={rows} emptyContent="Sin calificaciones.">
                {(r) => (
                  <TableRow key={r.id}>
                    <TableCell><Stars n={r.rating} /></TableCell>
                    <TableCell><span className="text-sm font-medium">{r.tenant?.name || "—"}</span></TableCell>
                    <TableCell>
                      <span className="text-sm">{r.user?.name || "—"}</span>
                      {r.user?.email && <div className="text-xs text-default-400">{r.user.email}</div>}
                    </TableCell>
                    <TableCell><span className="text-sm text-default-600">{r.comment || <span className="text-default-300">—</span>}</span></TableCell>
                    <TableCell><Chip size="sm" variant="flat" className="capitalize">{r.source}</Chip></TableCell>
                    <TableCell className="text-sm text-default-500">{fmtDate(r.createdAt)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </CardBody>
        </Card>
      </DataState>
    </div>
  );
}
