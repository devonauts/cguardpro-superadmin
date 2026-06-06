import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
} from "@heroui/react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { fmtDateTime, statusColor } from "@/lib/format";
import type { AuditEntry } from "@/types";

export function AuditDetailsModal({
  entry,
  isOpen,
  onClose,
}: {
  entry: AuditEntry | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const json = entry?.details != null ? JSON.stringify(entry.details, null, 2) : null;

  const copy = async () => {
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
      toast.success("Details copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {(close) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <span className="text-base font-semibold">Audit entry</span>
              {entry && (
                <span className="text-xs font-normal text-default-500">
                  {fmtDateTime(entry.createdAt)} · {entry.actorEmail || "system"}
                </span>
              )}
            </ModalHeader>
            <ModalBody>
              {entry && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <Field label="Action">
                      <Chip size="sm" variant="flat" color="secondary">
                        {entry.action}
                      </Chip>
                    </Field>
                    <Field label="Status">
                      {entry.statusCode != null ? (
                        <Chip
                          size="sm"
                          variant="flat"
                          color={
                            entry.statusCode >= 200 && entry.statusCode < 300
                              ? "success"
                              : entry.statusCode >= 500
                                ? "danger"
                                : "warning"
                          }
                        >
                          {entry.statusCode}
                        </Chip>
                      ) : (
                        <span className="text-default-400">—</span>
                      )}
                    </Field>
                    <Field label="Target">
                      {entry.targetType ? (
                        <span className="text-foreground">
                          {entry.targetType}
                          {entry.targetId ? (
                            <span className="text-default-400"> · {entry.targetId}</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-default-400">—</span>
                      )}
                    </Field>
                    <Field label="Tenant">
                      <span className={entry.tenantId ? "text-foreground" : "text-default-400"}>
                        {entry.tenantId || "—"}
                      </span>
                    </Field>
                    <Field label="Request">
                      {entry.method || entry.path ? (
                        <span className="font-mono text-xs text-foreground">
                          {entry.method} {entry.path}
                        </span>
                      ) : (
                        <span className="text-default-400">—</span>
                      )}
                    </Field>
                    <Field label="IP">
                      <span className={entry.ip ? "font-mono text-xs text-foreground" : "text-default-400"}>
                        {entry.ip || "—"}
                      </span>
                    </Field>
                    <Field label="Actor user ID">
                      <span className={entry.actorUserId ? "font-mono text-xs text-foreground" : "text-default-400"}>
                        {entry.actorUserId || "—"}
                      </span>
                    </Field>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-default-500">
                        Details
                      </span>
                      {json && (
                        <Button
                          size="sm"
                          variant="light"
                          startContent={<Copy className="h-3.5 w-3.5" />}
                          onPress={copy}
                        >
                          Copy
                        </Button>
                      )}
                    </div>
                    {json ? (
                      <pre className="max-h-80 overflow-auto rounded-medium border border-default-100 bg-default-50 p-3 font-mono text-xs leading-relaxed text-default-700">
                        {json}
                      </pre>
                    ) : (
                      <p className="rounded-medium border border-default-100 bg-default-50 p-3 text-sm text-default-400">
                        No additional details.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={close}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-default-500">{label}</span>
      <div>{children}</div>
    </div>
  );
}

export default AuditDetailsModal;
