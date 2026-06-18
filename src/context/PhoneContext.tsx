import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Call, Device, type TwilioError } from "@twilio/voice-sdk";
import { toast } from "sonner";
import { twilioService } from "@/services/twilio";
import { getSocket } from "@/lib/socket";
import { startRingtone, stopRingtone, beep } from "@/lib/ringtone";

/** High-level lifecycle of the in-browser softphone Device. */
export type DeviceState =
  | "loading"
  | "registering"
  | "ready"
  | "unconfigured"
  | "no-mic"
  | "error";

/** State of the single active/ringing call, if any. */
export type CallPhase = "idle" | "incoming" | "connecting" | "active";

interface PhoneContextValue {
  deviceState: DeviceState;
  deviceError: string | null;
  callPhase: CallPhase;
  peerNumber: string;
  muted: boolean;
  elapsed: number;
  dialInput: string;
  setDialInput: (v: string) => void;
  unreadCount: number;
  clearUnread: () => void;
  setupDevice: () => Promise<void>;
  placeCall: () => Promise<void>;
  dialNumber: (to: string) => Promise<void>;
  acceptCall: () => void;
  rejectCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
  pressDialKey: (key: string) => void;
}

const PhoneContext = createContext<PhoneContextValue | null>(null);

/** Light-touch E.164 normaliser for outbound dialling. */
function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  return digits ? "+" + digits : "";
}

/** Fire a browser notification (best-effort) that focuses + routes on click. */
function notify(title: string, body: string, onClick?: () => void): void {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const n = new Notification(title, { body, tag: "cguard-phone", renotify: true } as any);
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* notifications unsupported / blocked — ignore */
  }
}

/**
 * Global phone provider — mounted once in the authenticated Layout so the Twilio
 * Device registers a single time and survives route changes. Incoming calls and
 * new SMS surface a sound + browser notification + sidebar badge from anywhere.
 */
export function PhoneProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

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
  const [unreadCount, setUnreadCount] = useState(0);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  // Ask for notification permission once.
  useEffect(() => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Clear the unread badge whenever the user is on the phone page.
  useEffect(() => {
    if (location.pathname === "/phone") setUnreadCount(0);
  }, [location.pathname]);

  // ── Token plumbing ──────────────────────────────────────────────────────────
  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const { token } = await twilioService.voiceToken();
      return token || null;
    } catch {
      return null; // not configured / not authorised
    }
  }, []);

  // ── Wire a call's lifecycle events ──────────────────────────────────────────
  const bindCall = useCallback((call: Call) => {
    callRef.current = call;
    call.on("accept", () => {
      stopRingtone();
      setCallPhase("active");
      setMuted(call.isMuted());
      setCallStartedAt(Date.now());
    });
    const end = () => {
      stopRingtone();
      callRef.current = null;
      setCallPhase("idle");
      setPeerNumber("");
      setMuted(false);
      setCallStartedAt(null);
      setElapsed(0);
    };
    call.on("disconnect", end);
    call.on("cancel", end);
    call.on("reject", end);
    call.on("error", (err: TwilioError.TwilioError) => {
      toast.error(err?.message || "Call error");
      end();
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
      logLevel: "warn",
    });
    deviceRef.current = device;

    device.on("registered", () => setDeviceState("ready"));
    device.on("unregistered", () =>
      setDeviceState((s) => (s === "error" ? s : "registering")),
    );
    device.on("error", (err: TwilioError.TwilioError) => {
      const code = (err as any)?.code;
      if (code === 31402 || /microphone|getUserMedia|permission/i.test(err?.message || "")) {
        setDeviceState("no-mic");
        setDeviceError("Microphone access is required to place or receive calls.");
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
      const from = call.parameters?.From || "Unknown";
      setPeerNumber(from);
      setCallPhase("incoming");
      bindCall(call);
      startRingtone();
      if (pathRef.current !== "/phone") setUnreadCount((n) => n + 1);
      notify("Incoming call", `From ${from}`, () => navigate("/phone"));
    });

    try {
      setDeviceState("registering");
      await device.register();
    } catch (err: any) {
      setDeviceState("error");
      setDeviceError(err?.message || "Failed to register softphone");
    }
  }, [fetchToken, bindCall, navigate]);

  useEffect(() => {
    void setupDevice();
    return () => {
      stopRingtone();
      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
        } catch {
          /* ignore */
        }
        deviceRef.current = null;
      }
    };
    // setupDevice is stable for the provider lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── In-call timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (callPhase !== "active" || callStartedAt == null) return;
    const id = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - callStartedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [callPhase, callStartedAt]);

  // ── Global SMS + call socket notifications ──────────────────────────────────
  useEffect(() => {
    const s = getSocket();

    const onSms = (evt: any) => {
      const msg = evt?.message;
      if (!msg || msg.direction !== "inbound") return;
      // The SmsInbox page handles its own toast/list while open; notify globally
      // only when the user is elsewhere.
      if (pathRef.current === "/phone") return;
      setUnreadCount((n) => n + 1);
      beep();
      const from = msg.fromNumber || "Unknown";
      toast.info(`New SMS from ${from}`, {
        action: { label: "Open", onClick: () => navigate("/phone") },
      });
      notify("New SMS", `${from}: ${String(msg.body || "").slice(0, 80)}`, () =>
        navigate("/phone"),
      );
    };

    const onCallStatus = (evt: any) => {
      const terminal = ["completed", "canceled", "failed", "busy", "no-answer"];
      if (terminal.includes(evt?.status) && !callRef.current) {
        stopRingtone();
        setCallPhase("idle");
        setPeerNumber("");
      }
    };

    s.on("twilio:sms:inbound", onSms);
    s.on("twilio:call:status", onCallStatus);
    return () => {
      s.off("twilio:sms:inbound", onSms);
      s.off("twilio:call:status", onCallStatus);
    };
  }, [navigate]);

  // ── Call actions ────────────────────────────────────────────────────────────
  const dialNumber = useCallback(
    async (raw: string) => {
      const device = deviceRef.current;
      if (!device || deviceState !== "ready") {
        toast.error("Softphone is not ready");
        return;
      }
      const to = toE164(raw);
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
    },
    [deviceState, bindCall],
  );

  const placeCall = useCallback(() => dialNumber(dialInput), [dialNumber, dialInput]);

  const acceptCall = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    stopRingtone();
    setCallPhase("connecting");
    call.accept();
  }, []);

  const rejectCall = useCallback(() => {
    const call = callRef.current;
    stopRingtone();
    if (call) call.reject();
    callRef.current = null;
    setCallPhase("idle");
    setPeerNumber("");
  }, []);

  const hangup = useCallback(() => {
    const call = callRef.current;
    if (call) call.disconnect();
    else if (deviceRef.current) deviceRef.current.disconnectAll();
    stopRingtone();
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
        callRef.current.sendDigits(key);
        return;
      }
      setDialInput((v) => v + key);
    },
    [callPhase],
  );

  const value: PhoneContextValue = {
    deviceState,
    deviceError,
    callPhase,
    peerNumber,
    muted,
    elapsed,
    dialInput,
    setDialInput,
    unreadCount,
    clearUnread,
    setupDevice,
    placeCall,
    dialNumber,
    acceptCall,
    rejectCall,
    hangup,
    toggleMute,
    pressDialKey,
  };

  return <PhoneContext.Provider value={value}>{children}</PhoneContext.Provider>;
}

export function usePhone(): PhoneContextValue {
  const ctx = useContext(PhoneContext);
  if (!ctx) throw new Error("usePhone must be used within <PhoneProvider>");
  return ctx;
}
