import { useCallback, useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Button, Spinner } from "@heroui/react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { MessageSquare, PhoneCall, DollarSign, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { twilioService, type TwilioAnalytics } from "@/services/twilio";

type Period = "thismonth" | "lastmonth" | "today";

const PERIODS: { key: Period; label: string }[] = [
  { key: "thismonth", label: "Este mes" },
  { key: "lastmonth", label: "Mes pasado" },
  { key: "today", label: "Hoy" },
];

function money(n: number | undefined, ccy = "USD") {
  return `${ccy} ${(n ?? 0).toFixed(2)}`;
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="shadow-sm">
      <CardBody className="gap-1">
        <span className="flex items-center gap-2 text-xs font-medium text-default-500">{icon}{label}</span>
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {sub && <span className="text-xs text-default-400">{sub}</span>}
      </CardBody>
    </Card>
  );
}

export default function CommsAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("thismonth");
  const [data, setData] = useState<TwilioAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      setData(await twilioService.analytics(p));
    } catch {
      /* interceptor toasts */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [load, period]);

  const ccy = data?.currency || "USD";
  const daily = (data?.daily || []).map((d) => ({
    date: d.date.slice(5), // MM-DD
    SMS: Number(d.sms.toFixed(4)),
    Llamadas: Number(d.calls.toFixed(4)),
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Analítica de comunicaciones"
        subtitle="Mensajes y llamadas enviados con tu número Twilio y el gasto asociado"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {PERIODS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={period === p.key ? "solid" : "flat"}
              color={period === p.key ? "primary" : "default"}
              onPress={() => setPeriod(p.key)}
            >
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
            <Kpi icon={<DollarSign className="h-4 w-4" />} label="Gasto total" value={money(data.total?.cost, ccy)} sub="Periodo seleccionado" />
            <Kpi icon={<MessageSquare className="h-4 w-4" />} label="Mensajes (SMS)" value={String(data.sms?.count ?? 0)} sub={`${money(data.sms?.cost, ccy)} gastados`} />
            <Kpi icon={<PhoneCall className="h-4 w-4" />} label="Llamadas" value={String(data.calls?.count ?? 0)} sub={`${money(data.calls?.cost, ccy)} · ${data.calls?.minutes ?? 0} min`} />
            <Kpi icon={<DollarSign className="h-4 w-4" />} label="Costo prom. / SMS" value={money((data.sms?.count ? (data.sms?.cost || 0) / data.sms.count : 0), ccy)} sub="Por mensaje" />
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
                    <Tooltip
                      formatter={(v: number, name) => [`${ccy} ${Number(v).toFixed(4)}`, name as string]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend formatter={(v) => <span className="text-default-500 text-xs">{v}</span>} />
                    <Bar dataKey="SMS" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Llamadas" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>

          <p className="text-[11px] text-default-400">
            Datos de la API de uso de Twilio (fuente de facturación oficial). El gasto se contabiliza cuando Twilio
            cierra cada mensaje/llamada, por lo que el periodo actual puede ajustarse ligeramente.
          </p>
        </>
      )}
    </div>
  );
}
