import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardBody,
  Button,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Switch,
  Checkbox,
  useDisclosure,
} from "@heroui/react";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { plansService } from "@/services/plans";
import type { PlanCatalog, FeatureDef } from "@/types";

/** cents → editable dollar string ("" when null = use default). */
const centsToStr = (c: number | null) => (c == null ? "" : (c / 100).toString());
/** editable dollar string → cents or null. */
const strToCents = (s: string) => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

interface DraftPlan {
  id?: string;
  key: string;
  name: string;
  description: string;
  monthlyPerSeat: string; // dollars, "" = default
  implementation: string; // dollars, "" = default
  seatCap: string; // "" = unlimited
  features: string[];
  stripePriceId: string;
  active: boolean;
  isDefault: boolean;
  sortOrder: string;
}

const emptyDraft = (): DraftPlan => ({
  key: "",
  name: "",
  description: "",
  monthlyPerSeat: "",
  implementation: "",
  seatCap: "",
  features: [],
  stripePriceId: "",
  active: true,
  isDefault: false,
  sortOrder: "0",
});

function toDraft(p: PlanCatalog): DraftPlan {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description || "",
    monthlyPerSeat: centsToStr(p.monthlyPerSeatCents),
    implementation: centsToStr(p.implementationCents),
    seatCap: p.seatCap == null ? "" : String(p.seatCap),
    features: p.features || [],
    stripePriceId: p.stripePriceId || "",
    active: p.active,
    isDefault: p.isDefault,
    sortOrder: String(p.sortOrder ?? 0),
  };
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanCatalog[]>([]);
  const [features, setFeatures] = useState<FeatureDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const editModal = useDisclosure();
  const [draft, setDraft] = useState<DraftPlan>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await plansService.list();
      setPlans(res.plans || []);
      setFeatures(res.features || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setDraft(emptyDraft());
    editModal.onOpen();
  };
  const openEdit = (p: PlanCatalog) => {
    setDraft(toDraft(p));
    editModal.onOpen();
  };

  const patch = (p: Partial<DraftPlan>) => setDraft((d) => ({ ...d, ...p }));

  const toggleFeature = (key: string) =>
    setDraft((d) => ({
      ...d,
      features: d.features.includes(key)
        ? d.features.filter((f) => f !== key)
        : [...d.features, key],
    }));

  const save = async () => {
    if (!draft.key.trim() || !draft.name.trim()) {
      toast.error("Key and name are required.");
      return;
    }
    setSaving(true);
    const body = {
      key: draft.key.trim(),
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      monthlyPerSeatCents: strToCents(draft.monthlyPerSeat),
      implementationCents: strToCents(draft.implementation),
      seatCap: draft.seatCap.trim() === "" ? null : Number(draft.seatCap),
      features: draft.features,
      stripePriceId: draft.stripePriceId.trim() || null,
      active: draft.active,
      isDefault: draft.isDefault,
      sortOrder: Number(draft.sortOrder) || 0,
    };
    try {
      if (draft.id) {
        await plansService.update(draft.id, body);
        toast.success("Plan updated");
      } else {
        await plansService.create(body);
        toast.success("Plan created");
      }
      editModal.onClose();
      load();
    } catch {
      /* toast via interceptor */
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: PlanCatalog) => {
    if (!confirm(`Delete plan “${p.name}”? This cannot be undone.`)) return;
    try {
      await plansService.remove(p.id);
      toast.success("Plan deleted");
      load();
    } catch {
      /* toast via interceptor */
    }
  };

  const allFeatureCount = features.length;

  return (
    <div>
      <PageHeader
        title="Planes"
        subtitle="Catálogo de precios, límites de usuarios y funciones por plan."
        actions={
          <Button
            color="primary"
            startContent={<Plus className="h-4 w-4" />}
            onPress={openCreate}
          >
            Nuevo plan
          </Button>
        }
      />

      <DataState loading={loading} error={error} onRetry={load}>
        <Card className="shadow-sm">
          <CardBody>
            <Table removeWrapper aria-label="Plans">
              <TableHeader>
                <TableColumn>Plan</TableColumn>
                <TableColumn>Precio / usuario</TableColumn>
                <TableColumn>Implementación</TableColumn>
                <TableColumn>Límite</TableColumn>
                <TableColumn>Funciones</TableColumn>
                <TableColumn>Tenants</TableColumn>
                <TableColumn>Estado</TableColumn>
                <TableColumn aria-label="Actions">{""}</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No hay planes.">
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.isDefault && (
                          <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                        )}
                        <code className="text-xs text-default-400">{p.key}</code>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.monthlyPerSeatCents == null
                        ? <span className="text-default-400">Default</span>
                        : `$${(p.monthlyPerSeatCents / 100).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      {p.implementationCents == null
                        ? <span className="text-default-400">Default</span>
                        : `$${(p.implementationCents / 100).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      {p.seatCap == null
                        ? <span className="text-default-400">∞</span>
                        : p.seatCap}
                    </TableCell>
                    <TableCell>
                      {!p.features || p.features.length === 0
                        ? <span className="text-default-400">Todas</span>
                        : `${p.features.length} / ${allFeatureCount}`}
                    </TableCell>
                    <TableCell>{p.tenantCount ?? 0}</TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        variant="flat"
                        color={p.active ? "success" : "default"}
                      >
                        {p.active ? "Activo" : "Inactivo"}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => openEdit(p)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          isDisabled={!!p.tenantCount}
                          onPress={() => remove(p)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </DataState>

      {/* Create / edit modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={editModal.onClose}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>{draft.id ? "Editar plan" : "Nuevo plan"}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Key"
                description="Identificador estable (free, growth, …)"
                variant="bordered"
                value={draft.key}
                onValueChange={(v) => patch({ key: v })}
                isDisabled={!!draft.id}
              />
              <Input
                label="Nombre"
                variant="bordered"
                value={draft.name}
                onValueChange={(v) => patch({ name: v })}
              />
              <Textarea
                label="Descripción"
                variant="bordered"
                className="sm:col-span-2"
                value={draft.description}
                onValueChange={(v) => patch({ description: v })}
              />
              <Input
                label="Precio / usuario / mes (USD neto)"
                placeholder="Default"
                type="number"
                variant="bordered"
                value={draft.monthlyPerSeat}
                onValueChange={(v) => patch({ monthlyPerSeat: v })}
              />
              <Input
                label="Implementación (USD neto)"
                placeholder="Default"
                type="number"
                variant="bordered"
                value={draft.implementation}
                onValueChange={(v) => patch({ implementation: v })}
              />
              <Input
                label="Límite de usuarios"
                placeholder="Ilimitado"
                type="number"
                variant="bordered"
                value={draft.seatCap}
                onValueChange={(v) => patch({ seatCap: v })}
              />
              <Input
                label="Orden"
                type="number"
                variant="bordered"
                value={draft.sortOrder}
                onValueChange={(v) => patch({ sortOrder: v })}
              />
              <Input
                label="Stripe price id"
                variant="bordered"
                className="sm:col-span-2"
                value={draft.stripePriceId}
                onValueChange={(v) => patch({ stripePriceId: v })}
              />
            </div>

            <div className="mt-2">
              <div className="mb-2 text-sm font-medium">
                Funciones incluidas
                <span className="ml-2 text-xs font-normal text-default-400">
                  (ninguna seleccionada = todas las funciones)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {features.map((f) => (
                  <Checkbox
                    key={f.key}
                    size="sm"
                    isSelected={draft.features.includes(f.key)}
                    onValueChange={() => toggleFeature(f.key)}
                  >
                    <span className="text-sm">{f.label}</span>
                    <span className="ml-1 text-xs text-default-400">
                      {f.description}
                    </span>
                  </Checkbox>
                ))}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-6">
              <Switch
                size="sm"
                isSelected={draft.active}
                onValueChange={(v) => patch({ active: v })}
              >
                Activo
              </Switch>
              <Switch
                size="sm"
                isSelected={draft.isDefault}
                onValueChange={(v) => patch({ isDefault: v })}
              >
                Plan por defecto (nuevos tenants)
              </Switch>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={editModal.onClose} isDisabled={saving}>
              Cancelar
            </Button>
            <Button color="primary" onPress={save} isLoading={saving}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
