import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
  Switch,
  Button,
  Chip,
  Tabs,
  Tab,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import {
  Megaphone,
  Send,
  Users,
  TriangleAlert,
  Zap,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  broadcastPushService,
  type BroadcastAudience,
} from "@/services/broadcastPush";

const TITLE_MAX = 80;
const BODY_MAX = 240;

type Target = "both" | "worker" | "supervisor" | "client";

const TARGET_LABEL: Record<Target, string> = {
  both: "toda la flota",
  worker: "C-Guard Pro (trabajadores)",
  supervisor: "C-Guard Pro Supervisor",
  client: "Mi Seguridad (clientes)",
};

export default function BroadcastPushPage() {
  const [audience, setAudience] = useState<BroadcastAudience | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(true);
  const [target, setTarget] = useState<Target>("both");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [timeSensitive, setTimeSensitive] = useState(false);
  const [sending, setSending] = useState(false);
  const confirm = useDisclosure();

  const loadAudience = useCallback(async () => {
    setLoadingAudience(true);
    try {
      setAudience(await broadcastPushService.audience());
    } catch {
      /* api client toasts the error */
    } finally {
      setLoadingAudience(false);
    }
  }, []);

  useEffect(() => {
    void loadAudience();
  }, [loadAudience]);

  const targetCount = useMemo(() => {
    if (!audience) return 0;
    if (target === "worker") return audience.worker;
    if (target === "supervisor") return audience.supervisor;
    if (target === "client") return audience.client;
    return audience.total;
  }, [audience, target]);

  // Warn only about the transport(s) the chosen target actually uses.
  const fcmWarn =
    !!audience &&
    (target === "both" || target === "worker" || target === "supervisor") &&
    !audience.fcmConfigured;
  const apnsWarn =
    !!audience && (target === "both" || target === "client") && !audience.apnsConfigured;

  const canSend =
    title.trim().length > 0 && body.trim().length > 0 && targetCount > 0;

  const doSend = useCallback(async () => {
    setSending(true);
    try {
      const res = await broadcastPushService.send({
        title: title.trim(),
        body: body.trim(),
        link: link.trim() || undefined,
        timeSensitive,
        app: target === "both" ? undefined : target,
      });
      confirm.onClose();
      if (res.error) {
        toast.error("Error al enviar la notificación.");
      } else {
        const parts: string[] = [];
        if (res.fcm?.sent) parts.push(`${res.fcm.sent} FCM`);
        if (res.apns?.sent) parts.push(`${res.apns.sent} APNs`);
        const detail = parts.length ? ` (${parts.join(" · ")})` : "";
        toast.success(`Enviado a ${res.sent} dispositivo(s)${detail}`);
        setTitle("");
        setBody("");
        setLink("");
        setTimeSensitive(false);
      }
      void loadAudience();
    } catch {
      /* api client toasts the error */
    } finally {
      setSending(false);
    }
  }, [title, body, link, timeSensitive, target, confirm, loadAudience]);

  return (
    <div>
      <PageHeader
        title="Broadcast push"
        subtitle="Envía una notificación a TODOS los dispositivos de TODOS los tenants — elige la app destino. Úsalo con cuidado."
        actions={
          <Button
            size="sm"
            variant="flat"
            startContent={
              <RefreshCw
                className={`h-4 w-4 ${loadingAudience ? "animate-spin" : ""}`}
              />
            }
            isLoading={loadingAudience}
            onPress={loadAudience}
          >
            Actualizar
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Composer */}
        <Card className="shadow-sm lg:col-span-3">
          <CardHeader className="flex items-center gap-2 pb-2">
            <Megaphone className="h-4 w-4 text-default-400" />
            <h2 className="text-sm font-semibold text-foreground">Mensaje</h2>
          </CardHeader>
          <CardBody className="gap-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">App destino</p>
              <Tabs
                aria-label="App destino"
                selectedKey={target}
                onSelectionChange={(k) => setTarget(k as Target)}
                color="primary"
                size="sm"
              >
                <Tab key="both" title="Toda la flota" />
                <Tab key="worker" title="C-Guard Pro" />
                <Tab key="supervisor" title="Supervisor" />
                <Tab key="client" title="Mi Seguridad" />
              </Tabs>
            </div>
            <Input
              label="Título"
              labelPlacement="outside"
              placeholder="Ej. Mantenimiento programado"
              value={title}
              onValueChange={setTitle}
              maxLength={TITLE_MAX}
              description={`${title.length}/${TITLE_MAX}`}
              isRequired
            />
            <Textarea
              label="Cuerpo"
              labelPlacement="outside"
              placeholder="Texto de la notificación que verán los usuarios."
              value={body}
              onValueChange={setBody}
              maxLength={BODY_MAX}
              minRows={3}
              description={`${body.length}/${BODY_MAX}`}
              isRequired
            />
            <Input
              label="Enlace (opcional)"
              labelPlacement="outside"
              placeholder="/notificaciones  ·  ruta in-app al tocar la notificación"
              value={link}
              onValueChange={setLink}
            />
            <div className="flex items-start justify-between gap-3 rounded-medium border border-default-100 bg-default-50/50 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="leading-tight">
                  <p className="text-sm font-medium text-foreground">
                    Time-sensitive
                  </p>
                  <p className="text-xs text-default-500">
                    Atraviesa los modos Concentración / No molestar e ilumina la
                    pantalla. Reserva para avisos urgentes.
                  </p>
                </div>
              </div>
              <Switch
                size="sm"
                isSelected={timeSensitive}
                onValueChange={setTimeSensitive}
                aria-label="Time-sensitive"
              />
            </div>
          </CardBody>
        </Card>

        {/* Audience + send */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="flex items-center gap-2 pb-2">
            <Users className="h-4 w-4 text-default-400" />
            <h2 className="text-sm font-semibold text-foreground">Audiencia</h2>
          </CardHeader>
          <CardBody className="gap-4">
            <div className="rounded-medium border border-primary/20 bg-primary/5 px-4 py-4 text-center">
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {loadingAudience ? "—" : targetCount.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-default-500">
                dispositivos · {TARGET_LABEL[target]}
              </p>
            </div>

            {/* Per-app breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-medium border border-default-100 bg-default-50/50 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-default-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="text-[11px]">C-Guard Pro</span>
                </div>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                  {audience ? audience.worker.toLocaleString() : "—"}
                </p>
              </div>
              <div className="rounded-medium border border-default-100 bg-default-50/50 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-default-500">
                  <UserCog className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Supervisor</span>
                </div>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                  {audience ? audience.supervisor.toLocaleString() : "—"}
                </p>
              </div>
              <div className="rounded-medium border border-default-100 bg-default-50/50 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-default-500">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Mi Seguridad</span>
                </div>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                  {audience ? audience.client.toLocaleString() : "—"}
                </p>
              </div>
            </div>

            {fcmWarn && (
              <div className="flex items-start gap-2 rounded-medium border border-warning/30 bg-warning/5 px-3 py-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-default-600">
                  FCM no está configurado — la app de trabajadores (C-Guard Pro) no
                  recibirá nada.
                </p>
              </div>
            )}
            {apnsWarn && (
              <div className="flex items-start gap-2 rounded-medium border border-warning/30 bg-warning/5 px-3 py-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-default-600">
                  APNs no está configurado — la app de clientes (Mi Seguridad) no
                  recibirá nada.
                </p>
              </div>
            )}

            <Button
              color="primary"
              startContent={<Send className="h-4 w-4" />}
              isDisabled={!canSend || loadingAudience}
              onPress={confirm.onOpen}
            >
              Enviar
            </Button>
            <p className="text-center text-[11px] text-default-400">
              Acción irreversible · se registra en el audit log
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Confirmation */}
      <Modal
        isOpen={confirm.isOpen}
        onClose={confirm.onClose}
        size="md"
        isDismissable={!sending}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Confirmar envío
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              Estás por enviar esta notificación a{" "}
              <span className="font-semibold text-foreground">
                {targetCount.toLocaleString()} dispositivos
              </span>{" "}
              de <span className="font-semibold text-foreground">{TARGET_LABEL[target]}</span>{" "}
              (todos los tenants). No se puede deshacer.
            </p>
            <div className="rounded-medium border border-default-100 bg-default-50/50 px-3 py-2.5">
              <p className="text-sm font-semibold text-foreground">
                {title.trim() || "—"}
              </p>
              <p className="mt-0.5 text-sm text-default-600">
                {body.trim() || "—"}
              </p>
              {timeSensitive && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="warning"
                  className="mt-2"
                  startContent={<Zap className="h-3 w-3" />}
                >
                  Time-sensitive
                </Chip>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={confirm.onClose} isDisabled={sending}>
              Cancelar
            </Button>
            <Button
              color="primary"
              onPress={doSend}
              isLoading={sending}
              startContent={!sending && <Send className="h-4 w-4" />}
            >
              Enviar ahora
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
