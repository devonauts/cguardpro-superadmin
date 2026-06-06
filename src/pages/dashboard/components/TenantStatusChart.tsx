import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import type { DashboardData } from "@/types";

type StatusDatum = { label: string; value: number; fill: string };

/** A compact bar chart of tenant counts grouped by lifecycle status. */
export function TenantStatusChart({ tenants }: { tenants: DashboardData["tenants"] }) {
  const data: StatusDatum[] = [
    { label: "Active", value: tenants.active, fill: "#22c55e" },
    { label: "Trialing", value: tenants.trialing, fill: "#6366f1" },
    { label: "Past due", value: tenants.pastDue, fill: "#f59e0b" },
    { label: "Suspended", value: tenants.suspended, fill: "#ef4444" },
    { label: "Canceled", value: tenants.canceled, fill: "#71717a" },
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-default-200" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "currentColor" }}
          className="text-default-500"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "currentColor" }}
          className="text-default-500"
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          cursor={{ fill: "currentColor", opacity: 0.06 }}
          contentStyle={{
            background: "hsl(var(--heroui-content1))",
            border: "1px solid hsl(var(--heroui-default-200))",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "hsl(var(--heroui-foreground))", fontWeight: 600 }}
          formatter={(value: number) => [value, "Tenants"]}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default TenantStatusChart;
