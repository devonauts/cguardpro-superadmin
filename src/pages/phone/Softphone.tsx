import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Call,
  Device,
  type TwilioError,
} from "@twilio/voice-sdk";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Chip,
  Spinner,
} from "@heroui/react";
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneCall,
  Mic,
  MicOff,
  Delete,
  AlertTriangle,
  Settings,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { twilioService } from "@/services/twilio";
import { useSocketEvent } from "@/lib/socket";

/** High-level lifecycle of the in-browser softphone Device. */
type DeviceState =
  | "loading" // fetching token / initialising
  | "registering"
  | "ready" // registered, idle
  | "unconfigured" // Twilio not configured yet (no token)
  | "no-mic" // microphone permission denied
  | "error";

/** State of the single active/ringing call, if any. */
type CallPhase = "idle" | "incoming" | "connecting" | "active";

const DIALPAD_KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "*",
  "0",
  "#",
];

/** Format seconds → m:ss for the in-call timer. */
function fmtDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Light-touch E.164 normaliser for outbound dialling. */
function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  return digits ? "+" + digits : "";
}

export default function Softphone() {
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  const [deviceState, setDeviceState] = useState<DeviceState>("loading");
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [peerNumber, setPeerNumber] = useState<string>("");
  const [muted, setMuted] = useState(false);

  const [dialInput, setDialInput] = useState("");
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // ── Token plumbing ────────────────────────────────────────────────────────

  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const { token } = await twilioService.voiceToken();
      return token || null;
    } catch {
      // 4xx (not configured / not authorised) → treat as unconfigured.
      return null;
    }
  }, []);

  // ── Wire a freshly-created/accepted Call's event handlers ───────────────────

  const bindCall = useCallback((call: Call) => {
    callRef.current = call;

    call.on("accept", () => {
      setCallPhase("active");
      setMuted(call.isMuted());
      setCallStartedAt(Date.now());
    });
    call.on("disconnect", () => {
      callRef.current = null;
      setCallPhase("idle");
      setPeerNumber("");
      setMuted(false);
      setCallStartedAt(null);
      setElapsed(0);
    });
    call.on("cancel", () => {
      callRef.current = null;
      setCallPhase("idle");
      setPeerNumber("");
    });
    call.on("reject", () => {
      callRef.current = null;
      setCallPhase("idle");
      setPeerNumber("");
    });
    call.on("error", (err: TwilioError.TwilioError) => {
      toast.error(err?.message || "Call error");
      callRef.current = null;
      setCallPhase("idle");
      setPeerNumber("");
    });
  }, []);

  // ── Device setup / teardown ─────────────────────────────────────────────────

  const setupDevice = useCallback(async () => {
    setDeviceState("loading");
    setDeviceError(null);

    const token = await fetchToken();
    if (!token) {
      setDeviceState("unconfigured");
      return;
    }

    // Tear down any prior device before creating a new one.
    if (deviceRef.current) {
      try {
        deviceRef.current.destroy();
      } catch {
        /* ignore */
      }
      deviceRef.current = null;
    }

    const device = new Device(token, {
      codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      // Log only warnings+ to keep the console clean in production.
      logLevel: "warn",
    });
    deviceRef.current = device;

    device.on("registered", () => setDeviceState("ready"));
    device.on("unregistered", () =>
      setDeviceState((s) => (s === "error" ? s : "registering")),
    );

    device.on("error", (err: TwilioError.TwilioError) => {
      // 31402 / 43xx microphone acquisition failures → mic permission hint.
      const code = (err as any)?.code;
      if (code === 31402 || /microphone|getUserMedia|permission/i.test(err?.message || "")) {
        setDeviceState("no-mic");
        setDeviceError(
          "Microphone access is required to place or receive calls.",
        );
        return;
      }
      setDeviceState("error");
      setDeviceError(err?.message || "Softphone error");
    });

    device.on("tokenWillExpire", async () => {
      const fresh = await fetchToken();
      if (fresh) device.updateToken(fresh);
    });

    device.on("incoming", (call: Call) => {
      // Single shared 'superadmin' identity: reflect the inbound caller id.
      setPeerNumber(call.parameters?.From || "Unknown");
      setCallPhase("incoming");
      bindCall(call);
    });

    try {
      setDeviceState("registering");
      await device.register();
    } catch (err: any) {
      setDeviceState("error");
      setDeviceError(err?.message || "Failed to register softphone");
    }
  }, [fetchToken, bindCall]);

  useEffect(() => {
    setupDevice();
    return () => {
      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
        } catch {
          /* ignore */
        }
        deviceRef.current = null;
      }
    };
    // setupDevice is stable for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live in-call timer ──────────────────────────────────────────────────────

  useEffect(() => {
    if (callPhase !== "active" || callStartedAt == null) return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - callStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [callPhase, callStartedAt]);

  // ── Socket events (call log / cross-tab state reflection) ───────────────────

  useSocketEvent<{ callSid: string; from: string }>(
    "twilio:call:incoming",
    (payload) => {
      // The Device 'incoming' event already drives the ringing UI on the
      // registered browser(s). This mirrors the caller id if the popup hasn't
      // surfaced yet (e.g. slight ordering) without overriding an active call.
      setCallPhase((phase) => {
        if (phase === "idle") {
          setPeerNumber(payload.from || "Unknown");
          return "incoming";
        }
        return phase;
      });
    },
  );

  useSocketEvent<{ callSid: string; status: string; durationSec?: number }>(
    "twilio:call:status",
    (payload) => {
      const terminal = ["completed", "canceled", "failed", "busy", "no-answer"];
      if (terminal.includes(payload.status) && !callRef.current) {
        // Remote side ended a call we have no local Call handle for.
        setCallPhase("idle");
        setPeerNumber("");
      }
    },
  );

  // ── Call actions ────────────────────────────────────────────────────────────

  const placeCall = useCallback(async () => {
    const device = deviceRef.current;
    if (!device || deviceState !== "ready") {
      toast.error("Softphone is not ready");
      return;
    }
    const to = toE164(dialInput);
    if (!to || to.length < 8) {
      toast.error("Enter a valid phone number (E.164, e.g. +14155551234)");
      return;
    }
    try {
      setCallPhase("connecting");
      setPeerNumber(to);
      const call = await device.connect({ params: { To: to } });
      bindCall(call);
    } catch (err: any) {
      toast.error(err?.message || "Failed to place call");
      setCallPhase("idle");
      setPeerNumber("");
    }
  }, [dialInput, deviceState, bindCall]);

  const acceptCall = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    setCallPhase("connecting");
    call.accept();
  }, []);

  const rejectCall = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    call.reject();
    callRef.current = null;
    setCallPhase("idle");
    setPeerNumber("");
  }, []);

  const hangup = useCallback(() => {
    const call = callRef.current;
    if (call) call.disconnect();
    else if (deviceRef.current) deviceRef.current.disconnectAll();
    setCallPhase("idle");
    setPeerNumber("");
  }, []);

  const toggleMute = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const next = !call.isMuted();
    call.mute(next);
    setMuted(next);
  }, []);

  const pressDialKey = useCallback(
    (key: string) => {
      if (callPhase === "active" && callRef.current) {
        // Send DTMF on an active call.
        callRef.current.sendDigits(key);
        return;
      }
      setDialInput((v) => v + key);
    },
    [callPhase],
  );

  const inCall = callPhase === "active" || callPhase === "connecting";
  const ringing = callPhase === "incoming";

  const statusChip = useMemo(() => {
    switch (deviceState) {
      case "ready":
        return (
          <Chip size="sm" color="success" variant="flat">
            Ready
          </Chip>
        );
      case "loading":
      case "registering":
        return (
          <Chip size="sm" color="default" variant="flat">
            Connecting…
          </Chip>
        );
      case "unconfigured":
        return (
          <Chip size="sm" color="warning" variant="flat">
            Not configured
          </Chip>
        );
      case "no-mic":
        return (
          <Chip size="sm" color="danger" variant="flat">
            Mic blocked
          </Chip>
        );
      default:
        return (
          <Chip size="sm" color="danger" variant="flat">
            Error
          </Chip>
        );
    }
  }, [deviceState]);

  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
          <span className="text-sm font-semibold text-foreground">Softphone</span>
        </div>
        <div className="flex items-center gap-2">
          {statusChip}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label="Reconnect softphone"
            onPress={setupDevice}
            isDisabled={deviceState === "loading" || deviceState === "registering"}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardBody className="flex flex-1 flex-col gap-4">
        {/* Unconfigured / mic / error hints */}
        {deviceState === "unconfigured" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-warning-200 bg-warning-50 p-5 text-center">
            <Settings className="h-7 w-7 text-warning" />
            <p className="text-sm font-medium text-foreground">
              Twilio isn't configured yet
            </p>
            <p className="text-xs text-default-500">
              Add your Twilio API key, TwiML App SID and phone number in
              Settings → Twilio, then reconnect to start making calls.
            </p>
          </div>
        )}

        {deviceState === "no-mic" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger-200 bg-danger-50 p-5 text-center">
            <MicOff className="h-7 w-7 text-danger" />
            <p className="text-sm font-medium text-foreground">
              Microphone access required
            </p>
            <p className="text-xs text-default-500">
              {deviceError ||
                "Allow microphone access in your browser, then reconnect."}
            </p>
            <Button size="sm" variant="flat" color="primary" onPress={setupDevice}>
              Retry
            </Button>
          </div>
        )}

        {deviceState === "error" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger-200 bg-danger-50 p-5 text-center">
            <AlertTriangle className="h-7 w-7 text-danger" />
            <p className="text-sm font-medium text-foreground">Softphone error</p>
            <p className="text-xs text-default-500">{deviceError}</p>
            <Button size="sm" variant="flat" color="primary" onPress={setupDevice}>
              Retry
            </Button>
          </div>
        )}

        {(deviceState === "loading" || deviceState === "registering") && (
          <div className="flex flex-1 items-center justify-center">
            <Spinner color="primary" label="Connecting softphone…" />
          </div>
        )}

        {/* Incoming call popup */}
        {ringing && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-primary-200 bg-primary-50 p-6 text-center">
            <PhoneIncoming className="h-9 w-9 animate-pulse text-primary" />
            <div>
              <p className="text-xs uppercase tracking-wide text-default-500">
                Incoming call
              </p>
              <p className="text-lg font-semibold text-foreground">
                {peerNumber || "Unknown"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                color="danger"
                variant="flat"
                startContent={<PhoneOff className="h-4 w-4" />}
                onPress={rejectCall}
              >
                Reject
              </Button>
              <Button
                color="success"
                className="text-white"
                startContent={<Phone className="h-4 w-4" />}
                onPress={acceptCall}
              >
                Accept
              </Button>
            </div>
          </div>
        )}

        {/* Active / connecting call UI */}
        {inCall && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-success-200 bg-success-50 p-6 text-center">
            <PhoneCall className="h-9 w-9 text-success-600" />
            <div>
              <p className="text-xs uppercase tracking-wide text-default-500">
                {callPhase === "connecting" ? "Calling" : "On call"}
              </p>
              <p className="text-lg font-semibold text-foreground">
                {peerNumber || "Unknown"}
              </p>
              <p className="mt-1 font-mono text-sm text-default-600">
                {callPhase === "active" ? fmtDuration(elapsed) : "…"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                isIconOnly
                size="lg"
                radius="full"
                variant={muted ? "solid" : "flat"}
                color={muted ? "warning" : "default"}
                aria-label={muted ? "Unmute" : "Mute"}
                onPress={toggleMute}
                isDisabled={callPhase !== "active"}
              >
                {muted ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
              <Button
                isIconOnly
                size="lg"
                radius="full"
                color="danger"
                aria-label="Hang up"
                onPress={hangup}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Dialer (only when ready & idle) */}
        {deviceState === "ready" && callPhase === "idle" && (
          <div className="flex flex-1 flex-col gap-3">
            <Input
              aria-label="Phone number to call"
              value={dialInput}
              onValueChange={setDialInput}
              placeholder="+1 415 555 1234"
              variant="bordered"
              startContent={<Phone className="h-4 w-4 text-default-400" />}
              endContent={
                dialInput ? (
                  <button
                    type="button"
                    aria-label="Delete last digit"
                    className="text-default-400 hover:text-foreground"
                    onClick={() => setDialInput((v) => v.slice(0, -1))}
                  >
                    <Delete className="h-4 w-4" />
                  </button>
                ) : null
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") placeCall();
              }}
            />

            <div className="grid grid-cols-3 gap-2">
              {DIALPAD_KEYS.map((k) => (
                <Button
                  key={k}
                  variant="flat"
                  className="h-12 text-lg font-medium"
                  onPress={() => pressDialKey(k)}
                >
                  {k}
                </Button>
              ))}
            </div>

            <Button
              color="success"
              size="lg"
              className="text-white"
              startContent={<Phone className="h-5 w-5" />}
              onPress={placeCall}
              isDisabled={!dialInput.trim()}
            >
              Call
            </Button>
          </div>
        )}

        {/* In-call dialpad for DTMF */}
        {callPhase === "active" && (
          <div className="grid grid-cols-3 gap-2">
            {DIALPAD_KEYS.map((k) => (
              <Button
                key={k}
                variant="flat"
                size="sm"
                className="h-10 text-base font-medium"
                onPress={() => pressDialKey(k)}
              >
                {k}
              </Button>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
