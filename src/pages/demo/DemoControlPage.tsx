import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Progress,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  ScrollShadow,
} from "@heroui/react";
import {
  RefreshCw,
  Play,
  ChevronRight,
  RotateCcw,
  CircleCheck,
  Circle,
  Loader2,
  Radio,
  Info,
  CircleAlert,
  CircleX,
  Sparkles,
  Lock,
  ClipboardList,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import {
  demoControlService,
  type DemoState,
  type DemoStep,
  type DemoLogEntry,
} from "@/services/demoControl";

export default function DemoControlPage() {
  const [state, setState] = useState<DemoState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Step number currently executing (null when idle). */
  const [runningStep, setRunningStep] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  const resetDialog = useDisclosure();
  const mounted = useRef(true);

  const load = useCallback(async (opts: { spinner?: boolean } = {}) => {
    const { spinner = true } = opts;
    if (spinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const s = await demoControlService.state();
      if (!mounted.current) return;
      setState(s);
    } catch (e: any) {
      if (!mounted.current) return;
      setError(e?.message || "No se pudo cargar el estado del demo.");
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const runStep = useCallback(
    async (step: number) => {
      if (runningStep != null || resetting) return;
      setRunningStep(step);
      try {
        const res = await demoControlService.runStep(step);
        if (!mounted.current) return;
        setState(res.state);
      } catch {
        /* api client toasts the error; refresh state to stay consistent */
        if (mounted.current) load({ spinner: false });
      } finally {
        if (mounted.current) setRunningStep(null);
      }
    },
    [runningStep, resetting, load],
  );

  const doReset = useCallback(async () => {
    setResetting(true);
    try {
      const res = await demoControlService.reset();
      if (!mounted.current) return;
      setState(res.state);
      resetDialog.onClose();
    } catch {
      /* api client toasts the error */
    } finally {
      if (mounted.current) setResetting(false);
    }
  }, [resetDialog]);

  const allDone = state ? state.currentStep > state.totalSteps : false;
  const nextStep = allDone ? null : state?.currentStep ?? null;
  const progressPct = state
    ? Math.round(((state.currentStep - 1) / Math.max(1, state.totalSteps)) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        title="Demo Control"
        subtitle="Driver de la demostración en vivo — dispara acciones reales del producto, paso a paso, frente al prospecto."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="flat"
              startContent={<RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />}
              isLoading={refreshing}
              onPress={() => load({ spinner: false })}
            >
              Actualizar
            </Button>
            <Button
              size="sm"
              variant="flat"
              color="danger"
              startContent={<RotateCcw className="h-4 w-4" />}
              isDisabled={!state?.available || runningStep != null || resetting}
              onPress={resetDialog.onOpen}
            >
              Reiniciar demo
            </Button>
          </div>
        }
      />

      <DataState loading={loading} error={error} onRetry={load}>
        {state && !state.available && <UnavailableNotice />}

        {state && state.available && (
          <div className="flex flex-col gap-6">
            {/* Demo identity + progress banner */}
            <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-sm">
              <CardBody className="gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-foreground">
                        {state.tenantName || "Tenant demo"}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-default-500">
                        <Lock className="h-3 w-3" />
                        Acciones limitadas exclusivamente al tenant demo
                        {state.tenantId && (
                          <span className="font-mono text-default-400"> · {state.tenantId}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {allDone ? (
                      <Chip size="sm" variant="flat" color="success" startContent={<CircleCheck className="h-3.5 w-3.5" />}>
                        Demo completada
                      </Chip>
                    ) : (
                      <Chip size="sm" variant="flat" color="primary">
                        Paso {state.currentStep} de {state.totalSteps}
                      </Chip>
                    )}
                  </div>
                </div>
                <div>
                  <Progress
                    aria-label="Progreso de la demo"
                    size="sm"
                    value={progressPct}
                    color={allDone ? "success" : "primary"}
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-default-400">
                    <span>
                      {state.lastResetAt
                        ? `Última reinicialización ${fmtRelative(state.lastResetAt)}`
                        : "Estado base sembrado"}
                    </span>
                    <span className="tabular-nums">{progressPct}%</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              {/* Stepper */}
              <Card className="shadow-sm lg:col-span-3">
                <CardHeader className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-default-400" />
                    <h2 className="text-sm font-semibold text-foreground">Operaciones de la demo</h2>
                  </div>
                  <Button
                    size="sm"
                    color="primary"
                    endContent={<ChevronRight className="h-4 w-4" />}
                    isDisabled={nextStep == null || runningStep != null || resetting}
                    isLoading={nextStep != null && runningStep === nextStep}
                    onPress={() => nextStep != null && runStep(nextStep)}
                  >
                    {allDone ? "Demo completa" : `Siguiente paso (${nextStep})`}
                  </Button>
                </CardHeader>
                <CardBody className="gap-1 pt-0">
                  {state.steps.map((s, idx) => (
                    <StepRow
                      key={s.step}
                      step={s}
                      isNext={s.step === nextStep}
                      isRunning={runningStep === s.step}
                      busy={runningStep != null || resetting}
                      isLast={idx === state.steps.length - 1}
                      onRun={() => runStep(s.step)}
                    />
                  ))}
                </CardBody>
              </Card>

              {/* Activity log */}
              <Card className="shadow-sm lg:col-span-2">
                <CardHeader className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-default-400" />
                    <h2 className="text-sm font-semibold text-foreground">Actividad en vivo</h2>
                  </div>
                  <Chip size="sm" variant="flat">{state.log.length}</Chip>
                </CardHeader>
                <CardBody className="pt-0">
                  {state.log.length === 0 ? (
                    <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center text-default-400">
                      <Radio className="h-7 w-7" />
                      <p className="text-sm">Aún no hay actividad. Ejecute un paso para verla aquí.</p>
                    </div>
                  ) : (
                    <ScrollShadow className="max-h-[460px]">
                      <ol className="flex flex-col gap-2.5 pr-1">
                        {state.log.map((entry) => (
                          <LogLine key={entry.id} entry={entry} />
                        ))}
                      </ol>
                    </ScrollShadow>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </DataState>

      {/* Reset confirmation */}
      <Modal isOpen={resetDialog.isOpen} onClose={resetDialog.onClose} size="md" isDismissable={!resetting}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-danger" />
            Reiniciar la demo
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              Esto restaura el estado base sembrado del tenant demo{" "}
              <span className="font-medium text-foreground">{state?.tenantName}</span>:
              borra asistencias, visitas, rondas, incidentes y novedades generadas durante la
              demostración y deja todo listo para el próximo prospecto.
            </p>
            <p className="text-xs text-default-400">
              Solo afecta al tenant demo. Ningún cliente real se ve impactado.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={resetDialog.onClose} isDisabled={resetting}>
              Cancelar
            </Button>
            <Button color="danger" onPress={doReset} isLoading={resetting} startContent={!resetting && <RotateCcw className="h-4 w-4" />}>
              Reiniciar demo
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function StepRow({
  step,
  isNext,
  isRunning,
  busy,
  isLast,
  onRun,
}: {
  step: DemoStep;
  isNext: boolean;
  isRunning: boolean;
  busy: boolean;
  isLast: boolean;
  onRun: () => void;
}) {
  return (
    <div className="relative flex gap-3">
      {/* Rail + node */}
      <div className="flex flex-col items-center">
        <div
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
            step.done
              ? "border-success bg-success/10 text-success"
              : isNext
                ? "border-primary bg-primary/10 text-primary"
                : "border-default-200 bg-content1 text-default-400",
          ].join(" ")}
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : step.done ? (
            <CircleCheck className="h-4 w-4" />
          ) : (
            step.step
          )}
        </div>
        {!isLast && (
          <div className={`my-1 w-px flex-1 ${step.done ? "bg-success/30" : "bg-default-150"}`} />
        )}
      </div>

      {/* Body */}
      <div className={`flex flex-1 items-start justify-between gap-3 rounded-medium px-3 py-2.5 ${isNext ? "bg-primary/5" : ""} ${!isLast ? "mb-1" : ""}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{step.title}</span>
            {step.done && step.ranAt && (
              <span className="text-[11px] text-default-400">{fmtRelative(step.ranAt)}</span>
            )}
            {isNext && (
              <Chip size="sm" variant="flat" color="primary" className="h-5">Siguiente</Chip>
            )}
          </div>
          <p className="mt-0.5 text-xs text-default-500">{step.description}</p>
        </div>
        <Button
          size="sm"
          variant={isNext ? "solid" : "flat"}
          color={isNext ? "primary" : "default"}
          className="shrink-0"
          startContent={!isRunning && <Play className="h-3.5 w-3.5" />}
          isLoading={isRunning}
          isDisabled={busy && !isRunning}
          onPress={onRun}
        >
          {step.done ? "Repetir" : "Ejecutar"}
        </Button>
      </div>
    </div>
  );
}

const LEVEL_META: Record<DemoLogEntry["level"], { color: string; Icon: typeof Info }> = {
  info: { color: "text-default-400", Icon: Info },
  success: { color: "text-success", Icon: CircleCheck },
  warning: { color: "text-warning", Icon: CircleAlert },
  error: { color: "text-danger", Icon: CircleX },
};

function LogLine({ entry }: { entry: DemoLogEntry }) {
  const { color, Icon } = LEVEL_META[entry.level] ?? LEVEL_META.info;
  return (
    <li className="flex gap-2.5 rounded-medium border border-default-100 bg-default-50/50 px-3 py-2">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{entry.message}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-default-400">
          <span>{fmtDateTime(entry.at)}</span>
          {entry.step > 0 && <span>· Paso {entry.step}</span>}
        </div>
      </div>
    </li>
  );
}

function UnavailableNotice() {
  return (
    <Card className="border border-warning/30 bg-warning/5 shadow-sm">
      <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">Demo no disponible en este entorno</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-default-500">
            El tenant demo no está aprovisionado aquí, por lo que el orquestador de demostraciones
            está deshabilitado. Siembre el tenant demo para habilitar este panel.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
