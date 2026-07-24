import { useCallback, useEffect, useState } from "react";
import {
  Card, CardBody, CardHeader, Button, Chip, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from "@heroui/react";
import { RefreshCw, ShieldCheck, MapPinOff, Ghost } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtDateTime } from "@/lib/format";
import { observabilityService, type IntegrityResult, type IntegritySample } from "@/services/observability";

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "ok" | "warn" }) {
  const bad = value > 0;
  return (
    <Card className="shadow-sm">
      <CardBody className="gap-1">
        <span className="flex items-center gap-2 text-xs font-medium text-default-500">{icon}{label}</span>
        <span className={`text-3xl font-bold ${bad ? (tone === "warn" ? "text-warning-600" : "text-danger") : "text-success-600"}`}>{value}</span>
        <span className="text-xs text-default-400">{bad ? "requiere revisión" : "sin problemas"}</span>
      </CardBody>
    </Card>
  );
}

function FindingsTable({ title, hint, icon, rows }: { title: string; hint: string; icon: React.ReactNode; rows: IntegritySample[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col items-start gap-0.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">{icon}{title}</span>
        <span className="text-[11px] text-default-400">{hint}</span>
      </CardHeader>
      <CardBody>
        <div className="overflow-x-auto">
          <Table aria-label={title} removeWrapper isHeaderSticky className="max-h-[360px] overflow-auto">
            <TableHeader>
              <TableColumn width={220}>VIGILANTE</TableColumn>
              <TableColumn>DETALLE</TableColumn>
              <TableColumn width={260}>EMPRESA (TENANT)</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Sin hallazgos en esta categoría." items={rows}>
              {(r) => (
                <TableRow key={`${r.tenantId}-${r.label}-${r.detail}`}>
                  <TableCell className="text-sm font-medium text-foreground">{r.label}</TableCell>
                  <TableCell className="text-sm text-default-600">{r.detail}</TableCell>
                  <TableCell className="text-[11px] text-default-400">{r.tenantId || "—"}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardBody>
    </Card>
  );
}

export default function IntegrityPage() {
  const [data, setData] = useState<IntegrityResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await observabilityService.integrity());
    } catch {
      /* interceptor toasts */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const clean = data && data.total === 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Integridad de horarios"
        subtitle="Detecta corrupción de datos de programación antes de que un cliente reclame: turnos en la estación equivocada, turnos fantasma de vigilantes removidos, y rotaciones con el offset desalineado."
        actions={
          <Button size="sm" variant="flat" startContent={<RefreshCw className="h-4 w-4" />} isLoading={loading} onPress={load}>Actualizar</Button>
        }
      />

      {loading && !data ? (
        <div className="flex justify-center py-16"><Spinner color="primary" label="Escaneando…" /></div>
      ) : (
        <>
          {clean && (
            <Card className="border border-success-200 bg-success-50/50 shadow-sm dark:bg-success-500/10">
              <CardBody className="flex flex-row items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-success-600" />
                <span className="text-sm font-medium text-success-700 dark:text-success-400">Sin inconsistencias detectadas. Todos los turnos coinciden con su estación y asignación.</span>
              </CardBody>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Stat icon={<MapPinOff className="h-4 w-4" />} label="Turnos en estación equivocada" value={data?.mismatchedStationShifts ?? 0} tone="warn" />
            <Stat icon={<Ghost className="h-4 w-4" />} label="Turnos fantasma (asignación terminada)" value={data?.phantomShiftsOnEndedAssignments ?? 0} tone="warn" />
          </div>

          <FindingsTable
            title="Turnos en la estación equivocada"
            hint="El turno de un fijo quedó registrado en una estación distinta a la de su asignación. Se auto-corrige al regenerar la rotación de ese vigilante."
            icon={<MapPinOff className="h-4 w-4 text-warning-600" />}
            rows={data?.samples.mismatch || []}
          />
          <FindingsTable
            title="Turnos fantasma de asignaciones terminadas"
            hint="Turnos futuros que sobrevivieron después de remover al vigilante. El generador ya los purga; estos son remanentes previos."
            icon={<Ghost className="h-4 w-4 text-warning-600" />}
            rows={data?.samples.phantom || []}
          />

          {data && <p className="text-[11px] text-default-400">Escaneado {fmtDateTime(data.scannedAt)}{data.pid ? ` · worker pid ${data.pid}` : ""}. Auditoría automática diaria.</p>}
        </>
      )}
    </div>
  );
}
