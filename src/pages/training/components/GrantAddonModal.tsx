import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Autocomplete,
  AutocompleteItem,
  Select,
  SelectItem,
  Input,
  Button,
} from "@heroui/react";
import { toast } from "sonner";

import { trainingService } from "@/services/training";
import { tenantsService } from "@/services/tenants";
import type { AddonCourse, AddonCourseGrant, TenantRow } from "@/types";

export function GrantAddonModal({
  isOpen,
  onClose,
  onGranted,
  courses,
  presetCourseId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onGranted: (grant: AddonCourseGrant) => void;
  courses: AddonCourse[];
  presetCourseId?: string | null;
}) {
  const [courseId, setCourseId] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [seatCount, setSeatCount] = useState<string>("");
  const [pricePaid, setPricePaid] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reset on open; apply preset course.
  useEffect(() => {
    if (isOpen) {
      setCourseId(presetCourseId || "");
      setTenantId("");
      setTenantSearch("");
      setSeatCount("");
      setPricePaid("");
      setExpiresAt("");
    }
  }, [isOpen, presetCourseId]);

  // Load tenants for the picker (debounced on search).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setTenantLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await tenantsService.list({
          search: tenantSearch.trim() || undefined,
          limit: 25,
          page: 1,
        });
        if (!cancelled) setTenants(res.rows);
      } catch {
        // toast handled by interceptor
      } finally {
        if (!cancelled) setTenantLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isOpen, tenantSearch]);

  const canSubmit = useMemo(
    () => !!courseId && !!tenantId && !submitting,
    [courseId, tenantId, submitting],
  );

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const grant = await trainingService.createGrant({
        addonCourseId: courseId,
        tenantId,
        seatCount: seatCount.trim() ? Number(seatCount) : null,
        pricePaid: pricePaid.trim() ? Number(pricePaid) : null,
        expiresAt: expiresAt.trim() ? expiresAt : null,
      });
      const course = courses.find((c) => c.id === courseId);
      toast.success(
        `Granted “${course?.title || "course"}” to the selected tenant`,
      );
      onGranted(grant);
    } catch {
      // toast handled by interceptor
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isDismissable={!submitting}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-lg font-semibold">Grant addon course</span>
          <span className="text-sm font-normal text-default-500">
            Give a tenant access to a platform course. Re-granting updates the
            existing grant.
          </span>
        </ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Addon course"
              isRequired
              variant="bordered"
              className="sm:col-span-2"
              selectedKeys={courseId ? [courseId] : []}
              onChange={(e) => setCourseId(e.target.value)}
              isDisabled={!!presetCourseId}
            >
              {courses.map((c) => (
                <SelectItem key={c.id}>{c.title}</SelectItem>
              ))}
            </Select>

            <Autocomplete
              label="Tenant"
              isRequired
              variant="bordered"
              className="sm:col-span-2"
              placeholder="Search tenants…"
              isLoading={tenantLoading}
              inputValue={tenantSearch}
              onInputChange={setTenantSearch}
              selectedKey={tenantId || null}
              onSelectionChange={(key) => setTenantId((key as string) || "")}
              items={tenants}
            >
              {(t) => (
                <AutocompleteItem key={t.id} textValue={t.name}>
                  <div className="flex flex-col">
                    <span className="text-sm">{t.name}</span>
                    {t.email && (
                      <span className="text-xs text-default-400">{t.email}</span>
                    )}
                  </div>
                </AutocompleteItem>
              )}
            </Autocomplete>

            <Input
              label="Seat count"
              type="number"
              min={0}
              variant="bordered"
              placeholder="Unlimited"
              value={seatCount}
              onValueChange={setSeatCount}
            />
            <Input
              label="Price paid (USD)"
              type="number"
              min={0}
              step="0.01"
              variant="bordered"
              placeholder="0.00"
              value={pricePaid}
              onValueChange={setPricePaid}
            />
            <Input
              label="Expires at"
              type="date"
              variant="bordered"
              className="sm:col-span-2"
              value={expiresAt}
              onValueChange={setExpiresAt}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={submitting}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={submit}
            isLoading={submitting}
            isDisabled={!canSubmit}
          >
            Grant access
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default GrantAddonModal;
