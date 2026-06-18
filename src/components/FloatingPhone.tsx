import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { Phone, Minus, GripHorizontal, Maximize2, PhoneIncoming } from "lucide-react";
import Softphone from "@/pages/phone/Softphone";
import { usePhone } from "@/context/PhoneContext";

const POS_KEY = "cgp_phone_pos";
const MIN_KEY = "cgp_phone_min";
const WIDTH = 320;

/**
 * App-wide draggable softphone widget. When the user leaves the /phone page the
 * full phone view stays available as a floating, draggable, phone-styled widget
 * (collapsible to a bubble). Auto-expands on an incoming/active call. Renders the
 * shared <Softphone/> (state lives in PhoneProvider, so calls never drop on
 * navigation). Hidden on /phone itself.
 */
export default function FloatingPhone() {
  const { callPhase, unreadCount } = usePhone();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [minimized, setMinimized] = useState<boolean>(
    () => localStorage.getItem(MIN_KEY) === "1",
  );
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

  // Auto-expand when a call is ringing or live so it's never missed.
  useEffect(() => {
    if (callPhase === "incoming" || callPhase === "active" || callPhase === "connecting") {
      setMinimized(false);
    }
  }, [callPhase]);

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

  // Collapsed: a floating phone bubble (FAB) with a ring/unread indicator.
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMin(false)}
        aria-label="Open phone"
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
          <Button isIconOnly size="sm" variant="light" aria-label="Open phone center" onPress={() => navigate("/phone")}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button isIconOnly size="sm" variant="light" aria-label="Minimize" onPress={() => setMin(true)}>
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Full phone view (shared Softphone) */}
      <div className="max-h-[72vh] overflow-y-auto p-3">
        <Softphone />
      </div>
    </div>
  );
}
