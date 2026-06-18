import { useMemo, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  Mic,
  MicOff,
  Delete,
  AlertTriangle,
  Settings,
  RefreshCw,
  Grid3x3,
  User,
} from "lucide-react";
import { usePhone } from "@/context/PhoneContext";
import { formatPhone } from "./utils";

const PAD: { k: string; s: string }[] = [
  { k: "1", s: "" }, { k: "2", s: "ABC" }, { k: "3", s: "DEF" },
  { k: "4", s: "GHI" }, { k: "5", s: "JKL" }, { k: "6", s: "MNO" },
  { k: "7", s: "PQRS" }, { k: "8", s: "TUV" }, { k: "9", s: "WXYZ" },
  { k: "*", s: "" }, { k: "0", s: "+" }, { k: "#", s: "" },
];

function fmtDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function avatarText(num: string): string {
  const d = num.replace(/\D/g, "");
  return d ? d.slice(-2) : "";
}

/** A circular dialpad key with the classic letter sub-label. */
function PadKey({ k, sub, onPress }: { k: string; sub: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="mx-auto flex h-[52px] w-[52px] flex-col items-center justify-center rounded-full bg-default-100 leading-none transition-transform hover:bg-default-200 active:scale-90"
    >
      <span className="text-xl font-medium text-foreground">{k}</span>
      {sub ? <span className="mt-0.5 text-[8px] font-semibold tracking-[0.15em] text-default-400">{sub}</span> : null}
    </button>
  );
}

/**
 * Phone-styled softphone view for the /phone page and the floating widget.
 * All call state lives in PhoneProvider; this is a pure view.
 */
export default function Softphone() {
  const {
    deviceState, deviceError, callPhase, peerNumber, muted, elapsed,
    dialInput, setDialInput, setupDevice, placeCall, acceptCall, rejectCall,
    hangup, toggleMute, pressDialKey,
  } = usePhone();

  const [showDtmf, setShowDtmf] = useState(false);

  const ringing = callPhase === "incoming";
  const inCall = callPhase === "active" || callPhase === "connecting";

  const statusDot = useMemo(() => {
    const map: Record<string, [string, string]> = {
      ready: ["bg-success-500", "Listo"],
      loading: ["bg-default-400 animate-pulse", "Conectando…"],
      registering: ["bg-default-400 animate-pulse", "Conectando…"],
      unconfigured: ["bg-warning-500", "Sin configurar"],
      "no-mic": ["bg-danger-500", "Micrófono bloqueado"],
      error: ["bg-danger-500", "Error"],
    };
    const [dot, label] = map[deviceState] || map.error;
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-default-500">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
    );
  }, [deviceState]);

  // ── Incoming call screen ────────────────────────────────────────────────────
  if (ringing) {
    return (
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-gradient-to-b from-primary-50 to-content1 px-5 py-8 text-center">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
          <PhoneIncoming className="h-4 w-4 animate-pulse" /> Llamada entrante
        </div>
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-600 text-2xl font-semibold text-white shadow-lg">
            {avatarText(peerNumber) || <User className="h-9 w-9" />}
          </div>
        </div>
        <p className="text-lg font-semibold text-foreground">{formatPhone(peerNumber) || "Desconocido"}</p>
        <div className="flex w-full items-center justify-around pt-2">
          <button
            type="button"
            onClick={rejectCall}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-danger text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            aria-label="Rechazar"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={acceptCall}
            className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-success-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            aria-label="Aceptar"
          >
            <Phone className="h-6 w-6" />
          </button>
        </div>
      </div>
    );
  }

  // ── Active / connecting call screen ─────────────────────────────────────────
  if (inCall) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-3xl bg-gradient-to-b from-success-50 to-content1 px-5 py-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-success-400 to-success-600 text-2xl font-semibold text-white shadow-lg">
          {avatarText(peerNumber) || <User className="h-9 w-9" />}
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{formatPhone(peerNumber) || "Desconocido"}</p>
          <p className="mt-1 font-mono text-sm text-default-500">
            {callPhase === "active" ? fmtDuration(elapsed) : "Llamando…"}
          </p>
        </div>

        {showDtmf && callPhase === "active" && (
          <div className="grid w-full max-w-[220px] grid-cols-3 gap-2">
            {PAD.map(({ k, s }) => (
              <PadKey key={k} k={k} sub={s} onPress={() => pressDialKey(k)} />
            ))}
          </div>
        )}

        <div className="flex w-full items-center justify-around pt-1">
          <button
            type="button"
            onClick={toggleMute}
            disabled={callPhase !== "active"}
            className={`flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-full transition ${
              muted ? "bg-warning-400 text-white" : "bg-default-100 text-foreground hover:bg-default-200"
            } disabled:opacity-40`}
            aria-label={muted ? "Activar micrófono" : "Silenciar"}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setShowDtmf((v) => !v)}
            disabled={callPhase !== "active"}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
              showDtmf ? "bg-primary text-white" : "bg-default-100 text-foreground hover:bg-default-200"
            } disabled:opacity-40`}
            aria-label="Teclado"
          >
            <Grid3x3 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => { setShowDtmf(false); hangup(); }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-danger text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            aria-label="Colgar"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
    );
  }

  // ── Non-call states ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        {statusDot}
        <Button
          isIconOnly size="sm" variant="light" aria-label="Reconectar"
          onPress={setupDevice}
          isDisabled={deviceState === "loading" || deviceState === "registering"}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {deviceState === "unconfigured" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-5 text-center">
          <Settings className="h-7 w-7 text-warning" />
          <p className="text-sm font-medium text-foreground">Twilio aún no está configurado</p>
          <p className="text-xs text-default-500">
            Agrega tu API Key, TwiML App SID y número en Configuración → Twilio y reconecta.
          </p>
        </div>
      )}

      {deviceState === "no-mic" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger-200 bg-danger-50 p-5 text-center">
          <MicOff className="h-7 w-7 text-danger" />
          <p className="text-sm font-medium text-foreground">Se requiere acceso al micrófono</p>
          <p className="text-xs text-default-500">{deviceError || "Permite el micrófono en el navegador y reconecta."}</p>
          <Button size="sm" variant="flat" color="primary" onPress={setupDevice}>Reintentar</Button>
        </div>
      )}

      {deviceState === "error" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger-200 bg-danger-50 p-5 text-center">
          <AlertTriangle className="h-7 w-7 text-danger" />
          <p className="text-sm font-medium text-foreground">Error del teléfono</p>
          <p className="text-xs text-default-500">{deviceError}</p>
          <Button size="sm" variant="flat" color="primary" onPress={setupDevice}>Reintentar</Button>
        </div>
      )}

      {(deviceState === "loading" || deviceState === "registering") && (
        <div className="flex items-center justify-center py-10">
          <Spinner color="primary" label="Conectando teléfono…" />
        </div>
      )}

      {/* Dialer */}
      {deviceState === "ready" && (
        <div className="flex flex-col gap-4">
          {/* number display */}
          <div className="flex min-h-[44px] items-center justify-center gap-2 px-2">
            <span className="truncate text-center text-2xl font-light tracking-wide text-foreground">
              {dialInput || <span className="text-default-300">Marcar número</span>}
            </span>
            {dialInput && (
              <button
                type="button"
                aria-label="Borrar"
                className="text-default-400 hover:text-foreground"
                onClick={() => setDialInput(dialInput.slice(0, -1))}
              >
                <Delete className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-y-2">
            {PAD.map(({ k, s }) => (
              <PadKey key={k} k={k} sub={s} onPress={() => pressDialKey(k)} />
            ))}
          </div>

          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={placeCall}
              disabled={!dialInput.trim()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-success-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Llamar"
            >
              <Phone className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
