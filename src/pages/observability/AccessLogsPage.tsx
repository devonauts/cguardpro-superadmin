import { useCallback, useEffect, useState } from "react";
import {
  Card, CardBody, Button, Chip, Spinner, Input, Select, SelectItem, Switch,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from "@heroui/react";
import { KeyRound, RefreshCw, ShieldAlert, Search, Lock, Unlock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtDateTime } from "@/lib/format";
import { observabilityService, type AuthEventsResult, type LockedAccount } from "@/services/observability";

function LockedAccountsPanel() {
  const [rows, setRows] = useState<LockedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await observabilityService.lockedAccounts()).rows || []); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (id: string, action: "lock" | "unlock" | "logout") => {
    try {
      await observabilityService.accountAction(id, action);
      toast.success(action === "unlock" ? "Cuenta desbloqueada" : action === "lock" ? "Cuenta bloqueada" : "Sesiones cerradas");
      load();
    } catch { toast.error("No se pudo aplicar la acción"); }
  };
  const isLocked = (r: LockedAccount) => !!r.lockedUntil && new Date(r.lockedUntil) > new Date();
  return (
    <Card className="shadow-sm">
      <CardBody className="gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-default-500"><Lock className="h-4 w-4" /> Cuentas bloqueadas / con fallos</span>
        {loading ? <Spinner size="sm" /> : rows.length === 0 ? (
          <span className="text-xs text-success">Ninguna cuenta bloqueada o con fallos. ✅</span>
        ) : (
          <Table removeWrapper aria-label="Cuentas bloqueadas">
            <TableHeader>
              <TableColumn>CORREO</TableColumn>
              <TableColumn>FALLOS</TableColumn>
              <TableColumn>ESTADO</TableColumn>
              <TableColumn>ACCIONES</TableColumn>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><span className="text-xs">{r.email}</span></TableCell>
                  <TableCell>{r.failedLoginCount}</TableCell>
                  <TableCell>{isLocked(r)
                    ? <Chip size="sm" color="danger" variant="flat">Bloqueada</Chip>
                    : <Chip size="sm" variant="flat">Con fallos</Chip>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {isLocked(r)
                        ? <Button size="sm" variant="flat" color="success" startContent={<Unlock className="h-3 w-3" />} onPress={() => act(r.id, "unlock")}>Desbloquear</Button>
                        : <Button size="sm" variant="flat" startContent={<Lock className="h-3 w-3" />} onPress={() => act(r.id, "lock")}>Bloquear</Button>}
                      <Button size="sm" variant="light" startContent={<LogOut className="h-3 w-3" />} onPress={() => act(r.id, "logout")}>Cerrar sesiones</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

const WINDOWS = [
  { key: "60", label: "Última hora" },
  { key: "1440", label: "Últimas 24 h" },
  { key: "10080", label: "Últimos 7 días" },
];
const EVENTS = [
  { key: "", label: "Todos los eventos" },
  { key: "login", label: "Login" },
  { key: "login_failed", label: "Login fallido" },
  { key: "logout", label: "Logout" },
  { key: "rate_limited", label: "Rate limit (429)" },
  { key: "device_registered", label: "Dispositivo registrado" },
];

function outcomeColor(o: string | null): "success" | "danger" | "default" {
  if (o === "success") return "success";
  if (o === "failure") return "danger";
  return "default";
}

export default function AccessLogsPage() {
  const [data, setData] = useState<AuthEventsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const [minutes, setMinutes] = useState("1440");
  const [event, setEvent] = useState("");
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await observabilityService.authEvents({
        minutes: Number(minutes), event: event || undefined, email: email.trim() || undefined,
      }));
    } catch {
      toast.error("No se pudieron cargar los accesos");
    } finally {
      setLoading(false);
    }
  }, [minutes, event, email]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [auto, load]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accesos y autenticación"
        subtitle="Inicios de sesión, fallos, logouts, dispositivos y bloqueos por rate-limit — en todos los tenants."
        actions={
          <div className="flex items-center gap-3">
            <Switch size="sm" isSelected={auto} onValueChange={setAuto}>Auto 15s</Switch>
            <Button size="sm" variant="flat" startContent={<RefreshCw className="h-4 w-4" />} onPress={load}>Actualizar</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardBody className="gap-2">
            <span className="flex items-center gap-2 text-xs font-medium text-default-500"><ShieldAlert className="h-4 w-4" /> IPs con más fallos</span>
            {data?.topFailedIps.length ? data.topFailedIps.map((r) => (
              <div key={r.ip} className="flex items-center justify-between text-xs">
                <span className="font-mono">{r.ip}</span>
                <Chip size="sm" color="danger" variant="flat">{r.count}</Chip>
              </div>
            )) : <span className="text-xs text-success">Sin fallos en la ventana. ✅</span>}
          </CardBody>
        </Card>
        <Card className="shadow-sm">
          <CardBody className="gap-2">
            <span className="flex items-center gap-2 text-xs font-medium text-default-500"><ShieldAlert className="h-4 w-4" /> Correos con más fallos</span>
            {data?.topFailedEmails.length ? data.topFailedEmails.map((r) => (
              <div key={r.email} className="flex items-center justify-between text-xs">
                <span className="truncate max-w-[240px]">{r.email}</span>
                <Chip size="sm" color="danger" variant="flat">{r.count}</Chip>
              </div>
            )) : <span className="text-xs text-success">Sin fallos en la ventana. ✅</span>}
          </CardBody>
        </Card>
      </div>

      <LockedAccountsPanel />

      <div className="flex flex-wrap items-center gap-3">
        <Select label="Ventana" size="sm" className="max-w-[170px]" selectedKeys={[minutes]}
          onSelectionChange={(k) => setMinutes(String(Array.from(k)[0]))}>
          {WINDOWS.map((w) => <SelectItem key={w.key}>{w.label}</SelectItem>)}
        </Select>
        <Select label="Evento" size="sm" className="max-w-[190px]" selectedKeys={[event]}
          onSelectionChange={(k) => setEvent(String(Array.from(k)[0]))}>
          {EVENTS.map((e) => <SelectItem key={e.key}>{e.label}</SelectItem>)}
        </Select>
        <Input size="sm" className="max-w-[240px]" placeholder="Buscar correo…" value={email}
          onValueChange={setEmail} startContent={<Search className="h-4 w-4 text-default-400" />} />
      </div>

      <Card className="shadow-sm">
        <CardBody>
          {loading && !data ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <Table removeWrapper aria-label="Eventos de acceso" isHeaderSticky classNames={{ base: "max-h-[560px] overflow-auto" }}>
              <TableHeader>
                <TableColumn>HORA</TableColumn>
                <TableColumn>EVENTO</TableColumn>
                <TableColumn>RESULTADO</TableColumn>
                <TableColumn>CORREO</TableColumn>
                <TableColumn>IP</TableColumn>
                <TableColumn>DETALLE</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Sin eventos en la ventana.">
                {(data?.rows || []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><span className="text-xs">{fmtDateTime(r.at)}</span></TableCell>
                    <TableCell><span className="text-xs font-medium">{r.event}</span></TableCell>
                    <TableCell><Chip size="sm" variant="flat" color={outcomeColor(r.outcome)}>{r.outcome || "—"}</Chip></TableCell>
                    <TableCell><span className="text-xs">{r.email || "—"}</span></TableCell>
                    <TableCell><span className="font-mono text-[11px] text-default-500">{r.ip || "—"}</span></TableCell>
                    <TableCell><span className="text-[11px] text-default-400 line-clamp-1 max-w-[280px]">{r.detail || r.platform || "—"}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
