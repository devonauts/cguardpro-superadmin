/**
 * Co-navegación en vivo — the superadmin WATCHES a tenant user's live CRM
 * session. Pick a tenant → see who's online → click a user to mirror their
 * screen (DOM + cursor/clicks/scroll) in real time via rrweb, streamed over
 * socket.io from the tenant's browser. A persistent top bar shows who you're
 * watching with a one-click "Salir".
 *
 * The tenant sees a visible "Soporte está viendo tu sesión" banner while watched
 * (consent-by-transparency, handled by the CRM's CoBrowseAgent).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { tenantsService } from "@/services/tenants";
import type { TenantRow } from "@/types";
import { Eye, LogOut, Search, Users, Wifi, Loader2, Hand, Maximize2, Minimize2 } from "lucide-react";
import "rrweb/dist/rrweb.min.css";

type OnlineUser = { userId: string; name: string | null; roles: string[] };
type Target = { tenantId: string; tenantName: string; userId: string; userName: string };

export default function LiveSessions() {
  const socket = useMemo(() => getSocket(), []);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [search, setSearch] = useState("");
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live">("idle");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const replayerRef = useRef<any>(null);
  const bufferRef = useRef<any[]>([]);
  const startedRef = useRef(false);
  const connectTimerRef = useRef<any>(null);
  const [noSignal, setNoSignal] = useState(false);
  // Shared control + full-screen mode.
  const [hasControl, setHasControl] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const targetRef = useRef<Target | null>(null);
  const hasControlRef = useRef(false);
  const lastCursorRef = useRef(0);

  // Map a mouse event over the mirror to the tenant viewport, normalized 0..1
  // against the replayed iframe (so it maps across differing window sizes).
  const normFromEvent = (e: { clientX: number; clientY: number }): { nx: number; ny: number } | null => {
    const iframe = replayerRef.current?.iframe as HTMLIFrameElement | undefined;
    const rect = iframe?.getBoundingClientRect();
    if (!rect || rect.width < 2 || rect.height < 2) return null;
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
    return { nx, ny };
  };
  const sendControl = (kind: string, extra: Record<string, unknown> = {}) => {
    const t = targetRef.current;
    if (!t) return;
    socket.emit("cobrowse:control", { tenantId: t.tenantId, userId: t.userId, event: { kind, ...extra } });
  };
  const onMirrorMove = (e: React.MouseEvent) => {
    if (status !== "live") return;
    const now = Date.now();
    if (now - lastCursorRef.current < 40) return;
    lastCursorRef.current = now;
    const n = normFromEvent(e);
    if (n) sendControl("cursor", n);
  };
  const onMirrorClick = (e: React.MouseEvent) => {
    if (status !== "live" || !hasControlRef.current) return;
    const n = normFromEvent(e);
    if (n) sendControl("click", n);
  };
  const onMirrorWheel = (e: React.WheelEvent) => {
    if (status !== "live" || !hasControlRef.current) return;
    sendControl("scroll", { dx: e.deltaX, dy: e.deltaY });
  };
  const toggleControl = () => {
    const t = targetRef.current;
    if (!t) return;
    const next = !hasControlRef.current;
    hasControlRef.current = next;
    setHasControl(next);
    socket.emit("cobrowse:turn", { tenantId: t.tenantId, userId: t.userId, holder: next ? "support" : "tenant" });
  };

  // ── Tenants list (for the picker) ──────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    tenantsService.list({ search, limit: 50 }).then((p) => {
      if (alive) setTenants(p.rows || []);
    }).catch(() => { if (alive) setTenants([]); });
    return () => { alive = false; };
  }, [search]);

  // ── Who's online for the selected tenant ───────────────────────────────────
  const refreshOnline = (t: TenantRow) => {
    setLoadingOnline(true);
    socket.emit("cobrowse:online", { tenantId: t.id }, (res: any) => {
      setLoadingOnline(false);
      setOnline(res?.ok ? (res.users || []) : []);
    });
  };

  const pickTenant = (t: TenantRow) => {
    stopWatching();
    setTenant(t);
    setOnline([]);
    refreshOnline(t);
  };

  // ── Live replay wiring ──────────────────────────────────────────────────────
  const teardownReplayer = () => {
    try { replayerRef.current?.pause?.(); } catch { /* ignore */ }
    replayerRef.current = null;
    startedRef.current = false;
    bufferRef.current = [];
    if (containerRef.current) containerRef.current.innerHTML = "";
  };

  const ingest = async (events: any[]) => {
    if (!events?.length) return;
    const rr: any = await import("rrweb");
    const ReplayerClass = rr?.Replayer || rr?.default?.Replayer;
    // eslint-disable-next-line no-console
    console.log("[cobrowse] stream in:", events.length, "Replayer:", typeof ReplayerClass);
    for (const ev of events) {
      if (!startedRef.current) {
        bufferRef.current.push(ev);
        // rrweb needs a Meta(4) + FullSnapshot(2) to start. Once we have a full
        // snapshot in the buffer, boot the Replayer in live mode from it.
        const hasFull = bufferRef.current.some((e) => e.type === 2);
        if (hasFull && containerRef.current && typeof ReplayerClass === "function") {
          const seed = bufferRef.current.slice();
          bufferRef.current = [];
          startedRef.current = true;
          const replayer = new ReplayerClass(seed, {
            root: containerRef.current,
            liveMode: true,
            mouseTail: { strokeStyle: "#f59e0b" },
          });
          replayerRef.current = replayer;
          replayer.startLive(seed[0]?.timestamp);
          setStatus("live");
          setNoSignal(false);
          if (connectTimerRef.current) { clearTimeout(connectTimerRef.current); connectTimerRef.current = null; }
          // eslint-disable-next-line no-console
          console.log("[cobrowse] Replayer booted, going live");
        }
      } else {
        try { replayerRef.current?.addEvent(ev); } catch { /* ignore malformed */ }
      }
    }
  };

  const watch = (u: OnlineUser) => {
    if (!tenant) return;
    stopWatching();
    const t: Target = { tenantId: tenant.id, tenantName: tenant.name, userId: u.userId, userName: u.name || u.userId };
    setTarget(t);
    targetRef.current = t;
    hasControlRef.current = false;
    setHasControl(false);
    setStatus("connecting");
    setNoSignal(false);
    teardownReplayer();
    // If no stream boots the mirror within a few seconds, the target isn't
    // actually transmitting (closed tab / inactive) — surface that instead of
    // spinning "connecting" forever.
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    connectTimerRef.current = setTimeout(() => {
      if (!startedRef.current) setNoSignal(true);
    }, 8000);
    socket.emit("cobrowse:watch", { tenantId: t.tenantId, userId: t.userId }, (res: any) => {
      if (!res?.ok) { setStatus("idle"); setTarget(null); }
      else if (typeof res.targets === "number" && res.targets === 0) {
        // No live socket for this user on the server → definitely not online.
        setNoSignal(true);
      }
    });
  };

  const stopWatching = () => {
    const t = targetRef.current || target;
    if (t) {
      if (hasControlRef.current) socket.emit("cobrowse:turn", { tenantId: t.tenantId, userId: t.userId, holder: "tenant" });
      socket.emit("cobrowse:stop", { tenantId: t.tenantId, userId: t.userId });
    }
    if (connectTimerRef.current) { clearTimeout(connectTimerRef.current); connectTimerRef.current = null; }
    targetRef.current = null;
    hasControlRef.current = false;
    setHasControl(false);
    setFullscreen(false);
    setTarget(null);
    setStatus("idle");
    setNoSignal(false);
    teardownReplayer();
  };

  // Incoming rrweb stream + turn handoff from the tenant's browser.
  useEffect(() => {
    const onStream = (payload: { events?: any[] }) => { ingest(payload?.events || []); };
    const onTurn = (p: { holder?: string }) => {
      if (p?.holder === "tenant") { hasControlRef.current = false; setHasControl(false); }
    };
    socket.on("cobrowse:stream", onStream);
    socket.on("cobrowse:turn", onTurn);
    return () => { socket.off("cobrowse:stream", onStream); socket.off("cobrowse:turn", onTurn); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Stop watching if we leave the page.
  useEffect(() => () => { stopWatching(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar (persistent while watching) */}
      {target && (
        <div className={`flex items-center justify-between gap-3 border border-amber-500/40 bg-amber-500/10 px-4 py-2 ${fullscreen ? "fixed inset-x-0 top-0 z-[70] rounded-none bg-amber-500/95 backdrop-blur" : "sticky top-0 z-30 rounded-xl"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <Eye className="h-4 w-4" />
            Viendo a <b>{target.userName}</b> · {target.tenantName}
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              {status === "connecting" ? <><Loader2 className="h-3 w-3 animate-spin" /> conectando…</> : <><Wifi className="h-3 w-3" /> en vivo</>}
            </span>
            {hasControl && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                <Hand className="h-3 w-3" /> Tu turno
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status === "live" && (
              <button
                onClick={toggleControl}
                title="Tomar/soltar el control para hacer clic en la pantalla del usuario"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${hasControl ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-500 hover:bg-amber-600"}`}
              >
                <Hand className="h-3.5 w-3.5" /> {hasControl ? "Soltar control" : "Tomar control"}
              </button>
            )}
            <button
              onClick={() => setFullscreen((f) => !f)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {fullscreen ? "Ventana" : "Pantalla completa"}
            </button>
            <button
              onClick={stopWatching}
              className="inline-flex items-center gap-1.5 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
            >
              <LogOut className="h-3.5 w-3.5" /> Salir del acceso
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* Left: pick tenant → pick online user */}
        <div className="space-y-3">
          <div>
            <h1 className="text-lg font-bold">Co-navegación en vivo</h1>
            <p className="text-xs text-muted-foreground">Observa la sesión de un usuario para guiarlo y ver bugs en tiempo real.</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tenant…"
              className="w-full rounded-lg border border-border bg-background px-8 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <div className="max-h-[30vh] overflow-auto rounded-lg border border-border">
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => pickTenant(t)}
                className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted ${tenant?.id === t.id ? "bg-amber-500/10 font-semibold" : ""}`}
              >
                {t.name}
              </button>
            ))}
            {tenants.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Sin tenants.</div>}
          </div>

          {tenant && (
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> En línea ({online.length})</span>
                <button onClick={() => refreshOnline(tenant)} className="text-amber-600 hover:underline">Actualizar</button>
              </div>
              {loadingOnline ? (
                <div className="px-3 py-3 text-center text-xs text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
              ) : online.length === 0 ? (
                <div className="px-3 py-3 text-xs text-muted-foreground">Nadie con el CRM abierto ahora mismo.</div>
              ) : (
                online.map((u) => (
                  <button
                    key={u.userId}
                    onClick={() => watch(u)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${target?.userId === u.userId ? "bg-amber-500/10" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{u.name || u.userId}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{(u.roles || []).join(", ") || "—"}</span>
                    </span>
                    <Eye className="h-4 w-4 shrink-0 text-amber-600" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right: the live mirror */}
        <div className={`overflow-hidden border border-border bg-white ${fullscreen ? "fixed inset-0 z-[60] rounded-none pt-11" : "min-h-[60vh] rounded-xl"}`}>
          {!target ? (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-2 text-muted-foreground">
              <Eye className="h-8 w-8 opacity-40" />
              <p className="text-sm">Elige un tenant y un usuario en línea para ver su sesión.</p>
            </div>
          ) : (
            <div className="relative h-full w-full">
              <div ref={containerRef} className="cobrowse-stage h-full w-full" />
              {/* Mouse-capture overlay — relays the superadmin's pointer to the tenant.
                  Sits above the replayed iframe so we can read the coordinates. */}
              {status === "live" && (
                <div
                  className={`absolute inset-0 z-10 ${hasControl ? "cursor-crosshair" : "cursor-default"}`}
                  onMouseMove={onMirrorMove}
                  onClick={onMirrorClick}
                  onWheel={onMirrorWheel}
                />
              )}
              {status !== "live" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95 px-6 text-center">
                  {noSignal ? (
                    <>
                      <Eye className="h-8 w-8 opacity-40" />
                      <p className="text-sm font-semibold">No se recibe la sesión de {target.userName}.</p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        Es probable que haya cerrado la pestaña del CRM o no esté activo en este momento.
                        Actualiza la lista de usuarios en línea e intenta de nuevo — el usuario debe tener el CRM abierto.
                      </p>
                      <button
                        onClick={() => watch({ userId: target.userId, name: target.userName, roles: [] })}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400"
                      >
                        <Loader2 className="h-3.5 w-3.5" /> Reintentar
                      </button>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                      <p className="text-sm text-muted-foreground">Conectando con la sesión de {target.userName}…</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
