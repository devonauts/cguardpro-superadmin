import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Layers,
  Boxes,
  Users,
  Activity,
  ScrollText,
  ShieldCheck,
  Wallet,
  GraduationCap,
  Gift,
  Phone,
  PhoneCall,
  Bell,
  Megaphone,
  BarChart3,
  Gauge,
  Bug,
  Server,
  PlayCircle,
  Star,
} from "lucide-react";
import { usePhone } from "@/context/PhoneContext";
import { useNotifications } from "@/context/NotificationContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/tenants", label: "Tenants", icon: Building2 },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/plans", label: "Planes", icon: Layers },
  { to: "/sandboxes", label: "Sandboxes", icon: Boxes },
  { to: "/users", label: "Users", icon: Users },
  { to: "/feedback", label: "App Feedback", icon: Star },
  { to: "/phone", label: "Teléfono", icon: PhoneCall },
  { to: "/phone/analytics", label: "Analítica Comms", icon: BarChart3 },
  { to: "/notifications", label: "Notificaciones", icon: Bell },
  { to: "/broadcast-push", label: "Broadcast push", icon: Megaphone },
  { to: "/training/courses", label: "Addon courses", icon: GraduationCap },
  { to: "/training/grants", label: "Course grants", icon: Gift },
  { to: "/observability", label: "Observability", icon: Activity, end: true },
  { to: "/observability/queries", label: "Consultas DB", icon: Gauge },
  { to: "/observability/errors", label: "Errores", icon: Bug },
  { to: "/observability/workers", label: "Workers", icon: Server },
  { to: "/audit", label: "Audit log", icon: ScrollText },
  { to: "/settings/stripe", label: "Stripe", icon: Wallet },
  { to: "/settings/twilio", label: "Twilio", icon: Phone },
  { to: "/demo", label: "Demo Control", icon: PlayCircle },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { unreadCount } = usePhone();
  const { unread: notifUnread } = useNotifications();
  return (
    <div className="flex h-full w-64 flex-col border-r border-divider bg-content1">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">CGuard Pro</p>
          <p className="text-xs text-default-500">SuperAdmin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-default-600 hover:bg-default-100 hover:text-foreground",
              ].join(" ")
            }
          >
            <Icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
            <span className="flex-1">{label}</span>
            {to === "/phone" && unreadCount > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            {to === "/notifications" && notifUnread > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">
                {notifUnread > 99 ? "99+" : notifUnread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 text-[11px] text-default-400">
        Platform administration · restricted access
      </div>
    </div>
  );
}
