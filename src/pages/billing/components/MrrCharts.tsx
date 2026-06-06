import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { usd } from "@/lib/format";
import { billingStatusLabel } from "@/lib/format";
import type { BillingOverview } from "@/types";

const PLAN_COLORS: Record<string, string> = {
  free: "#71717a",
  growth: "#6366f1",
  enterprise: "#22c55e",
};

const STATUS_COLORS: Record<string, string> = {
  trialing: "#6366f1",
  active: "#22c55e",
  past_due: "#f59e0b",
  trial_expired: "#ef4444",
  canceled: "#71717a",
};

const tooltipStyle = {
  background: "hsl(var(--heroui-content1))",
  border: "1px solid hsl(var(--heroui-default-200))",
  borderRadius: 8,
  fontSize: 12,
} as const;

/** Bar chart of MRR (cents) grouped by plan. */
export function MrrByPlanChart({ data }: { data: BillingOverview["mrrByPlan"] }) {
  const rows = (data || []).map((d) => ({
    plan: d.plan,
    label: d.plan ? d.plan.charAt(0).toUpperCase() + d.plan.slice(1) : "—",
    mrrCents: d.mrrCents,
    tenants: d.tenants,
    fill: PLAN_COLORS[(d.plan || "").toLowerCase()] || "#6366f1",
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          className="text-default-200"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "currentColor" }}
          className="text-default-500"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "currentColor" }}
          className="text-default-500"
          tickLine={false}
          axisLine={false}
          width={68}
          tickFormatter={(v: number) => usd(v)}
        />
        <Tooltip
          cursor={{ fill: "currentColor", opacity: 0.06 }}
          contentStyle={tooltipStyle}
          labelStyle={{ color: "hsl(var(--heroui-foreground))", fontWeight: 600 }}
          formatter={(value: number, _name, item: any) => [
            `${usd(value)} · ${item?.payload?.tenants ?? 0} tenants`,
            "MRR",
          ]}
        />
        <Bar dataKey="mrrCents" radius={[6, 6, 0, 0]} maxBarSize={64}>
          {rows.map((d) => (
            <Cell key={d.plan} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Pie chart of tenant counts grouped by billing status. */
export function StatusBreakdownChart({ data }: { data: BillingOverview["byStatus"] }) {
  const rows = Object.entries(data || {})
    .map(([status, value]) => ({
      status,
      label: billingStatusLabel(status),
      value: Number(value) || 0,
      fill: STATUS_COLORS[status] || "#71717a",
    }))
    .filter((d) => d.value > 0);

  if (rows.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-default-400">
        No tenants yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={84}
          paddingAngle={2}
          stroke="hsl(var(--heroui-content1))"
        >
          {rows.map((d) => (
            <Cell key={d.status} fill={d.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: "hsl(var(--heroui-foreground))", fontWeight: 600 }}
          formatter={(value: number, name) => [`${value} tenants`, name as string]}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => <span className="text-default-500">{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
