import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card, CardBody, CardHeader, Button, Spinner, Chip,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from "@heroui/react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  MessageSquare, PhoneCall, DollarSign, RefreshCw, ArrowUp, ArrowDown,
  ArrowUpRight, ArrowDownLeft, Download, Target,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  twilioService, type TwilioAnalytics, type TwilioMessageItem, type TwilioCallItem,
} from "@/services/twilio";

type Period = "thismonth" | "lastmonth" | "today";
type Tab = "sms" | "calls";

const PERIODS: { key: Period; label: string }[] = [
  { key: "thismonth", label: "Este mes" },
  { key: "lastmonth", label: "Mes pasado" },
  { key: "today", label: "Hoy" },
];

const money = (n: number | undefined | null, ccy = "USD") => `${ccy} ${(n ?? 0).toFixed(2)}`;
const money4 = (n: number | null, ccy = "USD") => (n == null ? "—" : `${ccy} ${n.toFixed(4)}`);
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const peerOf = (dir: string, to: string, from: string) => (/outbound/i.test(dir) ? to : from);

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Kpi({ icon, label, value, sub, delta }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  delta?: { pct: number } | null;
}) {
  return (
    <Card className="shadow-sm">
      <CardBody className="gap-1">
        <span className="flex items-center gap-2 text-xs font-medium text-default-500">{icon}{label}</span>
        <span className="flex items-center gap-2 text-2xl font-bold text-foreground">
          {value}
          {delta && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${delta.pct > 0 ? "text-danger" : "text-success-600"}`}>
              {delta.pct > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(delta.pct).toFixed(0)}%
            </span>
          )}
        </span>
        {sub && <span className="text-xs text-default-400">{sub}</span>}
      </CardBody>
    </Card>
  );
}

function DirChip({ dir }: { dir: string }) {
  const out = /outbound/i.test(dir);
  return (
    <Chip size="sm" variant="flat" color={out ? "primary" : "success"} startContent={out ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}>
      {out ? "Saliente" : "Entrante"}
    </Chip>
  );
}

export default function CommsAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("thismonth");
  const [data, setData] = useState<TwilioAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("sms");
  const [messages, setMessages] = useState<TwilioMessageItem[]>([]);
  const [calls, setCalls] = useState<TwilioCallItem[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setLogLoading(true);
    try {
      const [a, m, c] = await Promise.all([
        twilioService.analytics(p),
        twilioService.messageLog(p, 100).catch(() => ({ ok: false } as any)),
        twilioService.callLog(p, 100).catch(() => ({ ok: false } as any)),
      ]);
      setData(a);
      setMessages(m.rows || []);
      setCalls(c.rows || []);
    } catch {
      /* interceptor toasts */
    } finally {
      setLoading(false);
      setLogLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [load, period]);

  const ccy = data?.currency || "USD";
  const daily = (data?.daily || []).map((d) => ({
    date: d.date.slice(5),
    SMS: Number(d.sms.toFixed(4)),
    Llamadas: Number(d.calls.toFixed(4)),
  }));

  const totalCost = data?.total?.cost ?? 0;
  const prev = data?.previousCost;
  const delta = prev != null && prev > 0 ? { pct: ((totalCost - prev) / prev) * 100 } : null;

  // Top destinations by spend (peer number = the other party), across SMS + calls.
  const topDestinations = useMemo(() => {
    const map: Record<string, { number: string; sms: number; calls: number; cost: number }> = {};
    const row = (n: string) => (map[n] ||= { number: n, sms: 0, calls: 0, cost: 0 });
    messages.forEach((m) => {
      const n = peerOf(m.direction, m.to, m.from);
      if (!n) return;
      const e = row(n); e.sms += 1; e.cost += m.price || 0;
    });
    calls.forEach((c) => {
      const n = peerOf(c.direction, c.to, c.from);
      if (!n) return;
      const e = row(n); e.calls += 1; e.cost += c.price || 0;
    });
    return Object.values(map).sort((a, b) => b.cost - a.cost).slice(0, 10);
  }, [messages, calls]);

  const exportCsv = useCallback(() => {
    if (tab === "sms") {
      downloadCsv(
        `mensajes-twilio-${period}.csv`,
        toCsv(
          ["Fecha", "Dirección", "De", "Para", "Mensaje", "Estado", "Segmentos", "Costo", "Moneda"],
          messages.map((m) => [fmtTime(m.dateSent), m.direction, m.from, m.to, m.body, m.status, m.segments, m.price ?? "", m.priceUnit || ccy]),
        ),
      );
    } else {
      downloadCsv(
        `llamadas-twilio-${period}.csv`,
        toCsv(
          ["Fecha", "Dirección", "De", "Para", "Duración(s)", "Estado", "Costo", "Moneda"],
          calls.map((c) => [fmtTime(c.startTime), c.direction, c.from, c.to, c.durationSec, c.status, c.price ?? "", c.priceUnit || ccy]),
        ),
      );
    }
  }, [tab, messages, calls, period, ccy]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Analítica de comunicaciones"
        subtitle="Mensajes y llamadas enviados con tu número Twilio y el gasto asociado"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {PERIODS.map((p) => (
            <Button key={p.key} size="sm" variant={period === p.key ? "solid" : "flat"}
              color={period === p.key ? "primary" : "default"} onPress={() => setPeriod(p.key)}>
              {p.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="flat" startContent={<RefreshCw className="h-4 w-4" />} isLoading={loading} onPress={() => load(period)}>
          Actualizar
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16"><Spinner color="primary" /></div>
      ) : !data?.ok ? (
        <Card className="shadow-sm"><CardBody>
          <p className="text-sm text-default-500">{data?.error || "Configura Twilio para ver la analítica."}</p>
        </CardBody></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={<DollarSign className="h-4 w-4" />} label="Gasto total" value={money(totalCost, ccy)}
              sub={prev != null ? `vs ${money(prev, ccy)} periodo anterior` : "Periodo seleccionado"} delta={delta} />
            <Kpi icon={<MessageSquare className="h-4 w-4" />} label="Mensajes (SMS)" value={String(data.sms?.count ?? 0)} sub={`${money(data.sms?.cost, ccy)} gastados`} />
            <Kpi icon={<PhoneCall className="h-4 w-4" />} label="Llamadas" value={String(data.calls?.count ?? 0)} sub={`${money(data.calls?.cost, ccy)} · ${data.calls?.minutes ?? 0} min`} />
            <Kpi icon={<DollarSign className="h-4 w-4" />} label="Costo prom. / SMS" value={money(data.sms?.count ? (data.sms?.cost || 0) / data.sms.count : 0, ccy)} sub="Por mensaje" />
          </div>

          <Card className="shadow-sm">
            <CardHeader className="text-sm font-semibold text-foreground">Gasto diario ({ccy})</CardHeader>
            <CardBody>
              {daily.length === 0 ? (
                <p className="py-10 text-center text-sm text-default-400">Sin actividad en este periodo.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={daily} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--heroui-default-200))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={48} />
                    <Tooltip formatter={(v: number, name) => [`${ccy} ${Number(v).toFixed(4)}`, name as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend formatter={(v) => <span className="text-default-500 text-xs">{v}</span>} />
                    <Bar dataKey="SMS" stackId="a" fill="#16a34a" maxBarSize={40} />
                    <Bar dataKey="Llamadas" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>

          {/* Top destinations by spend */}
          <Card className="shadow-sm">
            <CardHeader className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Target className="h-4 w-4" /> Top destinos por gasto
            </CardHeader>
            <CardBody>
              {topDestinations.length === 0 ? (
                <p className="py-6 text-center text-sm text-default-400">Sin actividad en este periodo.</p>
              ) : (
                <Table aria-label="Top destinos" removeWrapper>
                  <TableHeader>
                    <TableColumn>NÚMERO</TableColumn>
                    <TableColumn>SMS</TableColumn>
                    <TableColumn>LLAMADAS</TableColumn>
                    <TableColumn align="end">GASTO</TableColumn>
                  </TableHeader>
                  <TableBody items={topDestinations}>
                    {(d) => (
                      <TableRow key={d.number}>
                        <TableCell className="font-medium">{d.number}</TableCell>
                        <TableCell className="text-default-500">{d.sms}</TableCell>
                        <TableCell className="text-default-500">{d.calls}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{money4(d.cost, ccy)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>

          {/* Itemized log with per-item price */}
          <Card className="shadow-sm">
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant={tab === "sms" ? "solid" : "flat"} color={tab === "sms" ? "primary" : "default"}
                  startContent={<MessageSquare className="h-4 w-4" />} onPress={() => setTab("sms")}>
                  Mensajes ({messages.length})
                </Button>
                <Button size="sm" variant={tab === "calls" ? "solid" : "flat"} color={tab === "calls" ? "primary" : "default"}
                  startContent={<PhoneCall className="h-4 w-4" />} onPress={() => setTab("calls")}>
                  Llamadas ({calls.length})
                </Button>
              </div>
              <Button size="sm" variant="flat" startContent={<Download className="h-4 w-4" />}
                isDisabled={tab === "sms" ? !messages.length : !calls.length} onPress={exportCsv}>
                Exportar CSV
              </Button>
            </CardHeader>
            <CardBody>
              {tab === "sms" ? (
                <Table aria-label="Mensajes" removeWrapper isHeaderSticky className="max-h-[440px] overflow-auto">
                  <TableHeader>
                    <TableColumn>FECHA</TableColumn>
                    <TableColumn>DIRECCIÓN</TableColumn>
                    <TableColumn>DE / PARA</TableColumn>
                    <TableColumn>MENSAJE</TableColumn>
                    <TableColumn>ESTADO</TableColumn>
                    <TableColumn align="end">COSTO</TableColumn>
                  </TableHeader>
                  <TableBody isLoading={logLoading} loadingContent={<Spinner color="primary" />} emptyContent="Sin mensajes en este periodo" items={messages}>
                    {(m) => (
                      <TableRow key={m.sid}>
                        <TableCell className="whitespace-nowrap text-xs text-default-500">{fmtTime(m.dateSent)}</TableCell>
                        <TableCell><DirChip dir={m.direction} /></TableCell>
                        <TableCell className="text-xs">
                          <span className="block text-default-500">{m.from}</span>
                          <span className="block font-medium">{m.to}</span>
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate text-xs text-default-600">{m.body || "—"}</TableCell>
                        <TableCell><Chip size="sm" variant="flat" color={/delivered|sent|received/i.test(m.status) ? "success" : /failed|undelivered/i.test(m.status) ? "danger" : "default"}>{m.status}</Chip></TableCell>
                        <TableCell className="text-right font-mono text-sm">{money4(m.price, m.priceUnit || ccy)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table aria-label="Llamadas" removeWrapper isHeaderSticky className="max-h-[440px] overflow-auto">
                  <TableHeader>
                    <TableColumn>FECHA</TableColumn>
                    <TableColumn>DIRECCIÓN</TableColumn>
                    <TableColumn>DE / PARA</TableColumn>
                    <TableColumn>DURACIÓN</TableColumn>
                    <TableColumn>ESTADO</TableColumn>
                    <TableColumn align="end">COSTO</TableColumn>
                  </TableHeader>
                  <TableBody isLoading={logLoading} loadingContent={<Spinner color="primary" />} emptyContent="Sin llamadas en este periodo" items={calls}>
                    {(c) => (
                      <TableRow key={c.sid}>
                        <TableCell className="whitespace-nowrap text-xs text-default-500">{fmtTime(c.startTime)}</TableCell>
                        <TableCell><DirChip dir={c.direction} /></TableCell>
                        <TableCell className="text-xs">
                          <span className="block text-default-500">{c.from}</span>
                          <span className="block font-medium">{c.to}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{fmtDur(c.durationSec)}</TableCell>
                        <TableCell><Chip size="sm" variant="flat" color={/completed/i.test(c.status) ? "success" : /failed|busy|no-answer|canceled/i.test(c.status) ? "danger" : "default"}>{c.status}</Chip></TableCell>
                        <TableCell className="text-right font-mono text-sm">{money4(c.price, c.priceUnit || ccy)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>

          <p className="text-[11px] text-default-400">
            Datos de la API de Twilio (fuente de facturación oficial). El costo se finaliza cuando Twilio cierra cada
            mensaje/llamada, por lo que un ítem reciente puede mostrar costo pendiente y el periodo actual puede ajustarse.
          </p>
        </>
      )}
    </div>
  );
}
