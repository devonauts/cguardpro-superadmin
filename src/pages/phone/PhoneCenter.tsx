import { Card, CardBody, CardHeader } from "@heroui/react";
import { PhoneCall } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import SmsInbox from "./SmsInbox";
import Softphone from "./Softphone";

/**
 * Platform phone center — superadmin-only.
 *
 * Two panels sharing the single platform Twilio number:
 *   1. SMS inbox  (owned by the SMS agent; <SmsInbox/>)
 *   2. In-browser softphone (<Softphone/> — @twilio/voice-sdk Device)
 *
 * Both reflect realtime updates over the shared platform websocket
 * (src/lib/socket.ts → the 'superadmin' room, 'twilio:*' events).
 */
export default function PhoneCenter() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Teléfono"
        subtitle="Centro telefónico de la plataforma — SMS y llamadas de voz en el navegador"
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* SMS inbox: conversation list + thread + composer */}
        <div className="min-h-0 lg:h-[calc(100vh-12rem)]">
          <SmsInbox />
        </div>

        {/* In-browser softphone */}
        <Card className="min-h-0 shadow-sm lg:h-[calc(100vh-12rem)]">
          <CardHeader className="flex items-center gap-2 pb-0">
            <PhoneCall className="text-primary" style={{ width: 18, height: 18 }} />
            <span className="text-sm font-semibold text-foreground">Softphone</span>
          </CardHeader>
          <CardBody className="overflow-y-auto">
            <Softphone />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
