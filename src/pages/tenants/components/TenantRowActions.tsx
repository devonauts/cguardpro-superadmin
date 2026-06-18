import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react";
import {
  MoreVertical,
  Eye,
  PlayCircle,
  Trash2,
} from "lucide-react";

/**
 * Per-row quick-actions dropdown for the Tenants table.
 * Suspend lives on the detail page (it requires a reason); the list exposes the
 * one-click actions: open, reactivate a suspended tenant, and delete.
 */
export function TenantRowActions({
  suspended,
  onView,
  onReactivate,
  onDelete,
}: {
  suspended: boolean;
  onView: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          aria-label="Row actions"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Tenant actions">
        {[
          <DropdownItem
            key="view"
            startContent={<Eye className="h-4 w-4" />}
            onPress={onView}
          >
            View details
          </DropdownItem>,
          ...(suspended
            ? [
                <DropdownItem
                  key="reactivate"
                  color="success"
                  startContent={<PlayCircle className="h-4 w-4" />}
                  onPress={onReactivate}
                >
                  Reactivate
                </DropdownItem>,
              ]
            : []),
          <DropdownItem
            key="delete"
            className="text-danger"
            color="danger"
            startContent={<Trash2 className="h-4 w-4" />}
            onPress={onDelete}
          >
            Delete
          </DropdownItem>,
        ]}
      </DropdownMenu>
    </Dropdown>
  );
}

export default TenantRowActions;
