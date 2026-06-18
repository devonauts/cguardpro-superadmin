import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { Phone, PhoneOff, PhoneIncoming, PhoneCall, Mic, MicOff, MessageSquare } from "lucide-react";
import { usePhone } from "@/context/PhoneContext";

function fmt(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * App-wide floating call widget. Surfaces incoming + active calls on ANY page so
 * the superadmin can answer/manage without being on the phone center. Hidden on
 * /phone itself (the inline Softphone shows the same controls there).
 */
export default function CallOverlay() {
  const { callPhase, peerNumber, muted, elapsed, acceptCall, rejectCall, hangup, toggleMute } = usePhone();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (pathname === "/phone") return null;
  if (callPhase === "idle") return null;

  const ringing = callPhase === "incoming";
  const inCall = callPhase === "active" || callPhase === "connecting";

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-[300px] rounded-2xl border border-divider bg-content1 p-4 shadow-2xl">
      {ringing && (
        <div className="flex flex-col items-center gap-3 text-center">
          <PhoneIncoming className="h-8 w-8 animate-pulse text-primary" />
          <div>
            <p className="text-xs uppercase tracking-wide text-default-500">Incoming call</p>
            <p className="text-base font-semibold text-foreground">{peerNumber || "Unknown"}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button color="danger" variant="flat" size="sm" startContent={<PhoneOff className="h-4 w-4" />} onPress={rejectCall}>
              Reject
            </Button>
            <Button color="success" size="sm" className="text-white" startContent={<Phone className="h-4 w-4" />} onPress={acceptCall}>
              Accept
            </Button>
          </div>
        </div>
      )}

      {inCall && (
        <div className="flex flex-col items-center gap-3 text-center">
          <PhoneCall className="h-8 w-8 text-success-600" />
          <div>
            <p className="text-xs uppercase tracking-wide text-default-500">
              {callPhase === "connecting" ? "Calling" : "On call"}
            </p>
            <p className="text-base font-semibold text-foreground">{peerNumber || "Unknown"}</p>
            <p className="mt-0.5 font-mono text-sm text-default-600">
              {callPhase === "active" ? fmt(elapsed) : "…"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              isIconOnly size="md" radius="full"
              variant={muted ? "solid" : "flat"}
              color={muted ? "warning" : "default"}
              aria-label={muted ? "Unmute" : "Mute"}
              onPress={toggleMute}
              isDisabled={callPhase !== "active"}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button isIconOnly size="md" radius="full" color="danger" aria-label="Hang up" onPress={hangup}>
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/phone")}
        className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-default-500 hover:text-foreground"
      >
        <MessageSquare className="h-3.5 w-3.5" /> Open phone center
      </button>
    </div>
  );
}
