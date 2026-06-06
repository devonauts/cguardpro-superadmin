import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react";
import { MoreVertical, Archive, RotateCcw } from "lucide-react";

/**
 * Per-row action dropdown for the staff Users table.
 * Shows "Archive" for active users and "Reactivate" for archived users.
 */
export function RowActions({
  status,
  onArchive,
  onReactivate,
}: {
  status: string;
  onArchive: () => void;
  onReactivate: () => void;
}) {
  const isArchived = status === "archived";
  const isActive = status === "active";

  // Only active or archived rows have a meaningful toggle action.
  const disabled = !isActive && !isArchived;

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          aria-label="Row actions"
          isDisabled={disabled}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="User actions">
        {isArchived ? (
          <DropdownItem
            key="reactivate"
            color="success"
            startContent={<RotateCcw className="h-4 w-4" />}
            onPress={onReactivate}
          >
            Reactivate
          </DropdownItem>
        ) : (
          <DropdownItem
            key="archive"
            className="text-danger"
            color="danger"
            startContent={<Archive className="h-4 w-4" />}
            onPress={onArchive}
          >
            Archive
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
}

export default RowActions;
