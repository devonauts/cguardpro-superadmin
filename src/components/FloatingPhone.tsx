import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { Phone, Minus, GripHorizontal, Maximize2, PhoneIncoming, MessageSquare } from "lucide-react";
import Softphone from "@/pages/phone/Softphone";
import { SmsInbox } from "@/pages/phone/SmsInbox";
import { usePhone } from "@/context/PhoneContext";

const POS_KEY = "cgp_phone_pos";
const MIN_KEY = "cgp_phone_min";
const TAB_KEY = "cgp_phone_tab";
const WIDTH = 364;

type Tab = "phone" | "messages";

/**
 * App-wide draggable phone widget. Keeps the full phone view AND the SMS inbox
 * available on any page (tabbed), so calls and messages can be managed without
 * being on the Teléfono page. Collapses to a bubble; auto-expands on a call.
 * Hidden on /phone itself. Renders the shared <Softphone/> + <SmsInbox/> (state
 * lives in PhoneProvider / the socket, so nothing drops on navigation).
 */
export default function FloatingPhone() {
  const { callPhase, unreadCount, clearUnread } = usePhone();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [minimized, setMinimized] = useState<boolean>(() => localStorage.getItem(MIN_KEY) === "1");
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem(TAB_KEY) === "messages" ? "messages" : "phone"));
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const elRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const setMin = useCallback((v: boolean) => {
    setMinimized(v);
    try {
      localStorage.setItem(MIN_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const selectTab = useCallback((t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  // Auto-expand on a ringing/live call and jump to the phone tab.
  useEffect(() => {
    if (callPhase === "incoming" || callPhase === "active" || callPhase === "connecting") {
      setMinimized(false);
      setTab("phone");
    }
  }, [callPhase]);

  // Clear the unread badge while the messages tab is open.
  useEffect(() => {
    if (!minimized && tab === "messages" && unreadCount > 0) clearUnread();
  }, [minimized, tab, unreadCount, clearUnread]);

  const startDrag = useCallback((e: React.PointerEvent) => {
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const x = Math.max(8, Math.min(window.innerWidth - w - 8, ev.clientX - dragRef.current.dx));
      const y = Math.max(8, Math.min(window.innerHeight - h - 8, ev.clientY - dragRef.current.dy));
      setPos({ x, y });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(p));
          } catch {
            /* ignore */
          }
        }
        return p;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  if (pathname === "/phone") return null;

  const ringing = callPhase === "incoming";
  const active = callPhase === "active" || callPhase === "connecting";

  // Collapsed bubble.
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMin(false)}
        aria-label="Abrir teléfono"
        className={`fixed bottom-5 right-5 z-[100] grid h-14 w-14 place-items-center rounded-full text-white shadow-2xl transition-transform hover:scale-105 active:scale-95 ${
          ringing ? "animate-bounce bg-primary" : active ? "bg-success-600" : "bg-primary"
        }`}
      >
        {ringing ? <PhoneIncoming className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
        {(unreadCount > 0 || ringing || active) && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-content1">
            {ringing ? "!" : active ? "•" : unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    );
  }

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: 20, bottom: 20 };

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => selectTab(t)}
      className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
        tab === t ? "bg-content1 text-primary shadow-sm" : "text-default-500 hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      {t === "messages" && unreadCount > 0 && (
        <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-danger" />
      )}
    </button>
  );

  return (
    <div
      ref={elRef}
      style={{ width: WIDTH, ...style }}
      className="fixed z-[100] overflow-hidden rounded-3xl border border-divider bg-content1 shadow-2xl"
    >
      {/* Drag handle / title bar */}
      <div
        onPointerDown={startDrag}
        className="flex cursor-grab items-center justify-between gap-2 select-none bg-default-100 px-3 py-2 active:cursor-grabbing"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-default-600">
          <GripHorizontal className="h-4 w-4 text-default-400" />
          Teléfono
        </span>
        <div className="flex items-center gap-0.5">
          <Button isIconOnly size="sm" variant="light" aria-label="Abrir centro telefónico" onPress={() => navigate("/phone")}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button isIconOnly size="sm" variant="light" aria-label="Minimizar" onPress={() => setMin(true)}>
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-default-100 px-2 pb-2">
        {tabBtn("phone", "Llamadas", <Phone className="h-3.5 w-3.5" />)}
        {tabBtn("messages", "Mensajes", <MessageSquare className="h-3.5 w-3.5" />)}
      </div>

      {/* Content — both mounted (hidden) so SMS stays live + state persists */}
      <div className="h-[min(72vh,600px)]">
        <div className={tab === "phone" ? "h-full overflow-y-auto p-4" : "hidden"}>
          <Softphone />
        </div>
        <div className={tab === "messages" ? "h-full p-2" : "hidden"}>
          <SmsInbox compact />
        </div>
      </div>
    </div>
  );
}
