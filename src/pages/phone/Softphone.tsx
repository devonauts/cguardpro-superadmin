import { useMemo } from "react";
import { Card, CardBody, CardHeader, Button, Input, Chip, Spinner } from "@heroui/react";
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
import { usePhone } from "@/context/PhoneContext";

const DIALPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

/** Format seconds → m:ss for the in-call timer. */
function fmtDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Softphone panel for the /phone page. The Twilio Device and all call state live
 * in the app-level PhoneProvider (so calls work from any page); this component
 * is a pure view over that shared state.
 */
export default function Softphone() {
  const {
    deviceState,
    deviceError,
    callPhase,
    peerNumber,
    muted,
    elapsed,
    dialInput,
    setDialInput,
    setupDevice,
    placeCall,
    acceptCall,
    rejectCall,
    hangup,
    toggleMute,
    pressDialKey,
  } = usePhone();

  const inCall = callPhase === "active" || callPhase === "connecting";
  const ringing = callPhase === "incoming";

  const statusChip = useMemo(() => {
    switch (deviceState) {
      case "ready":
        return <Chip size="sm" color="success" variant="flat">Ready</Chip>;
      case "loading":
      case "registering":
        return <Chip size="sm" color="default" variant="flat">Connecting…</Chip>;
      case "unconfigured":
        return <Chip size="sm" color="warning" variant="flat">Not configured</Chip>;
      case "no-mic":
        return <Chip size="sm" color="danger" variant="flat">Mic blocked</Chip>;
      default:
        return <Chip size="sm" color="danger" variant="flat">Error</Chip>;
    }
  }, [deviceState]);

  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PhoneCall className="text-primary" style={{ width: 18, height: 18 }} />
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
        {deviceState === "unconfigured" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-warning-200 bg-warning-50 p-5 text-center">
            <Settings className="h-7 w-7 text-warning" />
            <p className="text-sm font-medium text-foreground">Twilio isn't configured yet</p>
            <p className="text-xs text-default-500">
              Add your Twilio API key, TwiML App SID and phone number in Settings → Twilio,
              then reconnect to start making calls.
            </p>
          </div>
        )}

        {deviceState === "no-mic" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger-200 bg-danger-50 p-5 text-center">
            <MicOff className="h-7 w-7 text-danger" />
            <p className="text-sm font-medium text-foreground">Microphone access required</p>
            <p className="text-xs text-default-500">
              {deviceError || "Allow microphone access in your browser, then reconnect."}
            </p>
            <Button size="sm" variant="flat" color="primary" onPress={setupDevice}>Retry</Button>
          </div>
        )}

        {deviceState === "error" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger-200 bg-danger-50 p-5 text-center">
            <AlertTriangle className="h-7 w-7 text-danger" />
            <p className="text-sm font-medium text-foreground">Softphone error</p>
            <p className="text-xs text-default-500">{deviceError}</p>
            <Button size="sm" variant="flat" color="primary" onPress={setupDevice}>Retry</Button>
          </div>
        )}

        {(deviceState === "loading" || deviceState === "registering") && (
          <div className="flex flex-1 items-center justify-center">
            <Spinner color="primary" label="Connecting softphone…" />
          </div>
        )}

        {/* Incoming call */}
        {ringing && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-primary-200 bg-primary-50 p-6 text-center">
            <PhoneIncoming className="h-9 w-9 animate-pulse text-primary" />
            <div>
              <p className="text-xs uppercase tracking-wide text-default-500">Incoming call</p>
              <p className="text-lg font-semibold text-foreground">{peerNumber || "Unknown"}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button color="danger" variant="flat" startContent={<PhoneOff className="h-4 w-4" />} onPress={rejectCall}>
                Reject
              </Button>
              <Button color="success" className="text-white" startContent={<Phone className="h-4 w-4" />} onPress={acceptCall}>
                Accept
              </Button>
            </div>
          </div>
        )}

        {/* Active / connecting */}
        {inCall && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-success-200 bg-success-50 p-6 text-center">
            <PhoneCall className="h-9 w-9 text-success-600" />
            <div>
              <p className="text-xs uppercase tracking-wide text-default-500">
                {callPhase === "connecting" ? "Calling" : "On call"}
              </p>
              <p className="text-lg font-semibold text-foreground">{peerNumber || "Unknown"}</p>
              <p className="mt-1 font-mono text-sm text-default-600">
                {callPhase === "active" ? fmtDuration(elapsed) : "…"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                isIconOnly size="lg" radius="full"
                variant={muted ? "solid" : "flat"}
                color={muted ? "warning" : "default"}
                aria-label={muted ? "Unmute" : "Mute"}
                onPress={toggleMute}
                isDisabled={callPhase !== "active"}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button isIconOnly size="lg" radius="full" color="danger" aria-label="Hang up" onPress={hangup}>
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Dialer (ready & idle) */}
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
                    onClick={() => setDialInput(dialInput.slice(0, -1))}
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
                <Button key={k} variant="flat" className="h-12 text-lg font-medium" onPress={() => pressDialKey(k)}>
                  {k}
                </Button>
              ))}
            </div>
            <Button
              color="success" size="lg" className="text-white"
              startContent={<Phone className="h-5 w-5" />}
              onPress={placeCall}
              isDisabled={!dialInput.trim()}
            >
              Call
            </Button>
          </div>
        )}

        {/* In-call DTMF dialpad */}
        {callPhase === "active" && (
          <div className="grid grid-cols-3 gap-2">
            {DIALPAD_KEYS.map((k) => (
              <Button key={k} variant="flat" size="sm" className="h-10 text-base font-medium" onPress={() => pressDialKey(k)}>
                {k}
              </Button>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
