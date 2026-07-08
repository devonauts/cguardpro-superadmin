import { useEffect, useState } from "react";
import {
  Card, CardBody, Button, Chip, Spinner, Textarea,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from "@heroui/react";
import { Table2, Activity, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { fmtBytes } from "@/lib/format";
import { observabilityService, type DbTable, type DbProcess } from "@/services/observability";

function ExplainBox() {
  const [sql, setSql] = useState("");
  const [plan, setPlan] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!sql.trim()) return;
    setBusy(true); setPlan(null);
    try {
      const r = await observabilityService.explain(sql);
      if (r.ok) setPlan(r.plan);
      else toast.error(r.error || "EXPLAIN falló");
    } catch { toast.error("EXPLAIN falló"); }
    finally { setBusy(false); }
  };
  return (
    <Card className="shadow-sm">
      <CardBody className="gap-2">
        <h4 className="flex items-center gap-2 text-xs font-medium text-default-500"><Search className="h-4 w-4" /> Explicar consulta (solo SELECT)</h4>
        <Textarea size="sm" minRows={2} placeholder="SELECT ... (una sola sentencia de lectura)" value={sql} onValueChange={setSql} />
        <div><Button size="sm" color="primary" variant="flat" isLoading={busy} onPress={run}>Explicar</Button></div>
        {plan && (
          <pre className="max-h-72 overflow-auto rounded bg-default-100 p-2 text-[11px] leading-tight text-default-600">
            {JSON.stringify(plan, null, 2)}
          </pre>
        )}
      </CardBody>
    </Card>
  );
}

export default function DbInspectionSection() {
  const [tables, setTables] = useState<DbTable[]>([]);
  const [procs, setProcs] = useState<DbProcess[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([
        observabilityService.dbTables().catch(() => null),
        observabilityService.dbProcessList().catch(() => null),
      ]);
      if (t) setTables(t.tables || []);
      if (p) setProcs(p.processes || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Table2 className="h-4 w-4" /> Inspección de base de datos</h3>
        <Button size="sm" variant="flat" startContent={<RefreshCw className="h-4 w-4" />} onPress={load}>Actualizar</Button>
      </div>

      {loading && tables.length === 0 ? (
        <div className="flex justify-center py-8"><Spinner size="sm" /></div>
      ) : (
        <>
          <Card className="shadow-sm">
            <CardBody>
              <h4 className="mb-2 text-xs font-medium text-default-500">Tablas por tamaño (datos + índices)</h4>
              <div className="overflow-x-auto">
              <Table removeWrapper aria-label="Tablas" isHeaderSticky classNames={{ base: "max-h-[360px] overflow-auto" }}>
                <TableHeader>
                  <TableColumn>TABLA</TableColumn>
                  <TableColumn>FILAS</TableColumn>
                  <TableColumn>DATOS</TableColumn>
                  <TableColumn>ÍNDICES</TableColumn>
                  <TableColumn>TOTAL</TableColumn>
                </TableHeader>
                <TableBody emptyContent="Sin datos.">
                  {tables.map((t) => (
                    <TableRow key={t.name}>
                      <TableCell><span className="font-mono text-xs">{t.name}</span></TableCell>
                      <TableCell>{t.rowCount.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-default-500">{fmtBytes(t.dataBytes)}</TableCell>
                      <TableCell className="text-xs text-default-500">{fmtBytes(t.indexBytes)}</TableCell>
                      <TableCell><span className="font-semibold text-xs">{fmtBytes(t.totalBytes)}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardBody>
          </Card>

          <Card className="shadow-sm">
            <CardBody>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-medium text-default-500">
                <Activity className="h-4 w-4" /> Conexiones activas (no inactivas)
              </h4>
              <div className="overflow-x-auto">
              <Table removeWrapper aria-label="Process list">
                <TableHeader>
                  <TableColumn>ID</TableColumn>
                  <TableColumn>CMD</TableColumn>
                  <TableColumn>TIEMPO</TableColumn>
                  <TableColumn>ESTADO</TableColumn>
                  <TableColumn>CONSULTA</TableColumn>
                </TableHeader>
                <TableBody emptyContent="Sin consultas activas. ✅">
                  {procs.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell><span className="text-xs">{p.id}</span></TableCell>
                      <TableCell><span className="text-xs">{p.command}</span></TableCell>
                      <TableCell><Chip size="sm" variant="flat" color={p.longRunning ? "danger" : "default"}>{p.time}s</Chip></TableCell>
                      <TableCell><span className="text-xs text-default-500">{p.state || "—"}</span></TableCell>
                      <TableCell><code className="block max-w-[420px] truncate text-[11px] text-default-600" title={p.info || ""}>{p.info || "—"}</code></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardBody>
          </Card>

          <ExplainBox />
        </>
      )}
    </div>
  );
}
