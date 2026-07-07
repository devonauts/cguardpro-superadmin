import { useEffect, useState } from "react";
import { Card, CardBody, Button, Chip, Spinner } from "@heroui/react";
import { DatabaseBackup, Play, CloudOff, Cloud } from "lucide-react";
import { toast } from "sonner";
import { fmtBytes, fmtDateTime } from "@/lib/format";
import { observabilityService, type BackupStatus } from "@/services/observability";

export default function BackupsCard() {
  const [data, setData] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await observabilityService.backups()); } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const r = await observabilityService.runBackup();
      toast[r.ok ? "success" : "error"](r.ok ? `Copia creada (${fmtBytes(r.sizeBytes || 0)})` : `Falló: ${r.error}`);
      load();
    } catch { toast.error("No se pudo crear la copia"); } finally { setRunning(false); }
  };

  const stale = data?.recent?.[0] ? (Date.now() - new Date(data.recent[0].at).getTime()) > 26 * 3600 * 1000 : true;

  return (
    <Card className="shadow-sm">
      <CardBody className="gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold"><DatabaseBackup className="h-4 w-4" /> Copias de seguridad (BD)</span>
          <Button size="sm" color="primary" variant="flat" startContent={<Play className="h-4 w-4" />} isLoading={running} onPress={runNow}>Copiar ahora</Button>
        </div>

        {loading && !data ? <Spinner size="sm" /> : data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {data.recent.length === 0
                ? <Chip size="sm" color="danger" variant="flat">Sin copias todavía</Chip>
                : <Chip size="sm" color={stale ? "warning" : "success"} variant="flat">
                    Última: {fmtDateTime(data.recent[0].at)} · {fmtBytes(data.recent[0].sizeBytes)}
                  </Chip>}
              <Chip size="sm" variant="flat" startContent={data.offsiteConfigured ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
                color={data.offsiteConfigured ? "success" : "default"}>
                {data.offsiteConfigured ? "Off-box (S3) activo" : "Solo local — configura S3"}
              </Chip>
              <Chip size="sm" variant="flat">Retiene {data.keep}</Chip>
            </div>
            {data.error && <span className="text-xs text-danger">Último error: {data.error}</span>}
            {data.recent.length > 0 && (
              <div className="max-h-40 overflow-auto text-[11px] text-default-500">
                {data.recent.map((b) => (
                  <div key={b.file} className="flex items-center justify-between border-b border-divider/50 py-0.5">
                    <span className="font-mono truncate max-w-[280px]">{b.file}</span>
                    <span>{fmtBytes(b.sizeBytes)} · {fmtDateTime(b.at)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-default-400">Directorio: <code>{data.dir}</code>. {!data.offsiteConfigured && "Para protección ante pérdida del servidor, define BACKUP_S3_BUCKET + AWS_* para copia off-box."}</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
