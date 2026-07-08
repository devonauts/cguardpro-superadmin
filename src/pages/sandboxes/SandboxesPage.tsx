import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { Boxes, Copy, ExternalLink, Sparkles, RotateCcw, Mail, MailX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { sandboxesService, type SandboxResult } from "@/services/sandboxes";

function copy(text: string, label = "Copiado") {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(label),
    () => toast.error("No se pudo copiar"),
  );
}

export default function SandboxesPage() {
  const [brandName, setBrandName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [clientCount, setClientCount] = useState("20");
  const [sendTo, setSendTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<SandboxResult | null>(null);

  const create = async () => {
    if (!brandName.trim()) {
      toast.error("Ingresa el nombre de la empresa del prospecto.");
      return;
    }
    setCreating(true);
    try {
      const res = await sandboxesService.create({
        brandName: brandName.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
        ownerFullName: ownerFullName.trim() || undefined,
        clientCount: Math.max(1, Math.min(40, parseInt(clientCount, 10) || 20)),
        sendCredentialsTo: sendTo.trim() || undefined,
      });
      setResult(res);
      if (res.emailedTo && res.emailSent) {
        toast.success(`Sandbox creado · credenciales enviadas a ${res.emailedTo}`);
      } else if (res.emailedTo && !res.emailSent) {
        toast.warning(`Sandbox creado, pero el correo falló (${res.emailError || "error"})`);
      } else {
        toast.success(`Sandbox "${res.tenantName}" creado`);
      }
    } catch {
      /* toast via interceptor */
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setBrandName("");
    setOwnerEmail("");
    setOwnerFullName("");
    setClientCount("20");
    setSendTo("");
    setResult(null);
  };

  const copyAll = () => {
    if (!result) return;
    const lines = [
      `Demo CGuardPro — ${result.tenantName}`,
      `Ingreso: ${result.loginUrl}`,
      "",
      ...result.accounts.map((a) => `${a.role}: ${a.email} / ${a.password}`),
    ];
    copy(lines.join("\n"), "Credenciales copiadas");
  };

  return (
    <div>
      <PageHeader
        title="Sandboxes de prospectos"
        subtitle="Crea un tenant de prueba pre-poblado y con la marca del prospecto, listo para entregar en la demo."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Nuevo sandbox</h2>
          </CardHeader>
          <CardBody className="gap-4">
            <Input
              label="Empresa del prospecto"
              isRequired
              variant="bordered"
              placeholder="Ej. Seguridad Andina"
              value={brandName}
              onValueChange={setBrandName}
              description="Se usa como nombre y marca del tenant de prueba."
            />
            <Input
              label="Email del contacto (opcional)"
              type="email"
              variant="bordered"
              placeholder="admin@prospecto.com"
              value={ownerEmail}
              onValueChange={setOwnerEmail}
              description="Si lo indicas, será el correo de la cuenta de administrador."
            />
            <Input
              label="Nombre del contacto (opcional)"
              variant="bordered"
              value={ownerFullName}
              onValueChange={setOwnerFullName}
            />
            <Input
              label="Número de clientes"
              type="number"
              min={1}
              max={40}
              variant="bordered"
              value={clientCount}
              onValueChange={setClientCount}
              description="Cada cliente trae su sitio, 2 puestos y 2 guardias (1–40)."
            />
            <Input
              label="Enviar credenciales por correo a (opcional)"
              type="email"
              variant="bordered"
              placeholder="prospecto@empresa.com"
              value={sendTo}
              onValueChange={setSendTo}
              startContent={<Mail className="h-4 w-4 text-default-400" />}
              description="Se envía desde demo@cguardpro.com con el enlace y los accesos."
            />
            <div className="flex gap-2">
              <Button
                color="primary"
                startContent={<Boxes className="h-4 w-4" />}
                isLoading={creating}
                onPress={create}
              >
                Crear sandbox
              </Button>
              {result && (
                <Button variant="flat" startContent={<RotateCcw className="h-4 w-4" />} onPress={resetForm}>
                  Nuevo
                </Button>
              )}
            </div>
            <p className="text-xs text-default-400">
              Cada sandbox es un tenant NUEVO en plan de prueba, con múltiples clientes
              —cada uno con su sitio, puestos y guardias— más horario, asistencia en vivo
              e historial (rondas, incidentes con foto, visitas, radio, relevos). No afecta
              a ningún cliente real ni al tenant de demo en vivo.
            </p>
          </CardBody>
        </Card>

        {/* Result */}
        <Card className="shadow-sm lg:col-span-3">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Credenciales</h2>
            {result && (
              <div className="flex gap-2">
                <Button size="sm" variant="flat" startContent={<Copy className="h-3.5 w-3.5" />} onPress={copyAll}>
                  Copiar todo
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  as="a"
                  href={result.loginUrl}
                  target="_blank"
                  rel="noreferrer"
                  startContent={<ExternalLink className="h-3.5 w-3.5" />}
                >
                  Abrir login
                </Button>
              </div>
            )}
          </CardHeader>
          <CardBody>
            {!result ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center text-default-400">
                <Boxes className="h-8 w-8" />
                <p className="text-sm">Crea un sandbox para ver las credenciales aquí.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Chip color="primary" variant="flat">{result.tenantName}</Chip>
                  <span className="font-mono text-xs text-default-400">{result.slug}</span>
                  <span className="text-default-500">·</span>
                  <a className="inline-flex items-center gap-1 text-primary hover:underline" href={result.loginUrl} target="_blank" rel="noreferrer">
                    {result.loginUrl} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Clientes", result.stats?.clients],
                    ["Guardias", result.stats?.guards],
                    ["Puestos", result.stats?.stations],
                    ["En turno", result.stats?.onDutyGuards],
                    ["Incidentes", result.stats?.incidents],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="rounded-medium border border-default-200 bg-default-50 px-3 py-1.5 text-center">
                      <div className="text-lg font-semibold text-foreground">{val ?? 0}</div>
                      <div className="text-[11px] text-default-500">{label}</div>
                    </div>
                  ))}
                </div>
                {result.emailedTo && (
                  result.emailSent ? (
                    <Chip color="success" variant="flat" startContent={<Mail className="h-3.5 w-3.5" />}>
                      Credenciales enviadas a {result.emailedTo}
                    </Chip>
                  ) : (
                    <Chip color="warning" variant="flat" startContent={<MailX className="h-3.5 w-3.5" />}>
                      No se pudo enviar el correo a {result.emailedTo}
                    </Chip>
                  )
                )}
                <div className="overflow-x-auto">
                <Table removeWrapper aria-label="Cuentas del sandbox">
                  <TableHeader>
                    <TableColumn>Rol</TableColumn>
                    <TableColumn>Correo</TableColumn>
                    <TableColumn>Contraseña</TableColumn>
                    <TableColumn aria-label="Copiar">{""}</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {result.accounts.map((a) => (
                      <TableRow key={a.email}>
                        <TableCell className="whitespace-nowrap">{a.role}</TableCell>
                        <TableCell className="font-mono text-xs">{a.email}</TableCell>
                        <TableCell className="font-mono text-xs">{a.password}</TableCell>
                        <TableCell>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            aria-label="Copiar credenciales"
                            onPress={() => copy(`${a.email} / ${a.password}`, `${a.role} copiado`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
