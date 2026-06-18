import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@heroui/react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { tenantsService } from "@/services/tenants";

/**
 * Confirmation modal for destructively deleting a tenant. To prevent deleting
 * the wrong organization (especially from the list view) the superadmin must
 * type the tenant's exact name before the action is enabled.
 */
export function DeleteTenantModal({
  isOpen,
  onClose,
  tenant,
  onDeleted,
}: {
  isOpen: boolean;
  onClose: () => void;
  tenant: { id: string; name: string } | null;
  onDeleted?: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [acting, setActing] = useState(false);

  // Clear the field whenever the modal opens or the target tenant changes.
  useEffect(() => {
    if (isOpen) setConfirmText("");
  }, [isOpen, tenant?.id]);

  const expected = tenant?.name?.trim() ?? "";
  const matches = expected.length > 0 && confirmText.trim() === expected;

  const close = () => {
    if (acting) return;
    setConfirmText("");
    onClose();
  };

  const doDelete = async () => {
    if (!tenant || !matches) return;
    setActing(true);
    try {
      const res = await tenantsService.remove(tenant.id);
      const n = res.recordsDeleted ?? 0;
      toast.success(
        `Tenant “${tenant.name}” deleted (${n} record${n === 1 ? "" : "s"} affected)`,
      );
      setConfirmText("");
      onClose();
      onDeleted?.();
    } catch {
      /* error toast handled by the api interceptor */
    } finally {
      setActing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} isDismissable={!acting}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 text-danger">
          <AlertTriangle className="h-5 w-5" />
          Delete tenant
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-500">
            This permanently removes{" "}
            <span className="font-semibold text-foreground">{tenant?.name}</span>{" "}
            and all of its associated data. This action cannot be undone.
          </p>
          <p className="text-sm text-default-500">
            Type the tenant name{" "}
            <span className="font-mono font-semibold text-danger">
              {tenant?.name}
            </span>{" "}
            to confirm.
          </p>
          <Input
            aria-label="Type the tenant name to confirm deletion"
            placeholder={tenant?.name}
            variant="bordered"
            value={confirmText}
            onValueChange={setConfirmText}
            autoFocus
            color={confirmText && !matches ? "danger" : "default"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches && !acting) doDelete();
            }}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" isDisabled={acting} onPress={close}>
            Cancel
          </Button>
          <Button
            color="danger"
            isLoading={acting}
            isDisabled={!matches}
            onPress={doDelete}
          >
            Delete tenant
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default DeleteTenantModal;
