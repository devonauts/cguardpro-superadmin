import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
  Switch,
  Button,
  Chip,
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
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  broadcastPushService,
  type BroadcastAudience,
} from "@/services/broadcastPush";

const TITLE_MAX = 80;
const BODY_MAX = 240;

export default function BroadcastPushPage() {
  const [audience, setAudience] = useState<BroadcastAudience | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(true);
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

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  const doSend = useCallback(async () => {
    setSending(true);
    try {
      const res = await broadcastPushService.send({
        title: title.trim(),
        body: body.trim(),
        link: link.trim() || undefined,
        timeSensitive,
      });
      confirm.onClose();
      if (res.skipped) {
        toast.warning(
          "Push no configurado (FCM) en el backend — no se envió ninguna notificación.",
        );
      } else if (res.error) {
        toast.error("Error al enviar la notificación.");
      } else {
        toast.success(
          `Enviado a ${res.sent} dispositivo(s)` +
            (res.failed ? ` · ${res.failed} fallidos` : ""),
        );
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
  }, [title, body, link, timeSensitive, confirm, loadAudience]);

  return (
    <div>
      <PageHeader
        title="Broadcast push"
        subtitle="Envía una notificación push a TODOS los dispositivos registrados de TODOS los tenants. Úsalo con cuidado."
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
                {loadingAudience ? "—" : (audience?.devices ?? 0).toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-default-500">
                dispositivos registrados (todos los tenants)
              </p>
              {audience && audience.uniqueTokens !== audience.devices && (
                <p className="mt-1 text-[11px] text-default-400">
                  {audience.uniqueTokens.toLocaleString()} tokens únicos
                </p>
              )}
            </div>

            {audience && !audience.configured && (
              <div className="flex items-start gap-2 rounded-medium border border-warning/30 bg-warning/5 px-3 py-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-default-600">
                  FCM no está configurado en el backend
                  (<span className="font-mono">FIREBASE_SERVICE_ACCOUNT</span>). El
                  envío no entregará nada hasta configurarlo.
                </p>
              </div>
            )}

            <Button
              color="primary"
              startContent={<Send className="h-4 w-4" />}
              isDisabled={!canSend || loadingAudience}
              onPress={confirm.onOpen}
            >
              Enviar a todos
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
                {(audience?.devices ?? 0).toLocaleString()} dispositivos
              </span>{" "}
              de todos los tenants. No se puede deshacer.
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
