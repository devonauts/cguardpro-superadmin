import { useEffect, useRef } from "react";
import { ScrollShadow, Spinner, Tooltip } from "@heroui/react";
import { AlertCircle, Check, CheckCheck, Clock } from "lucide-react";
import { clsx } from "clsx";

import type { TwilioMessage } from "@/services/twilio";
import {
  dayKey,
  formatBubbleTime,
  formatDaySeparator,
  formatRelative,
  statusKind,
} from "../utils";

interface Props {
  messages: TwilioMessage[];
  loading?: boolean;
  loadingOlder?: boolean;
  hasMore?: boolean;
  onLoadOlder?: () => void;
}

export function MessageThread({
  messages,
  loading,
  loadingOlder,
  hasMore,
  onLoadOlder,
}: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastId = messages.length ? messages[messages.length - 1].id : null;

  // Auto-scroll to the newest message when the tail changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  if (loading && !messages.length) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="sm" color="primary" />
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-default-400">
        No messages in this conversation yet. Say hello below.
      </div>
    );
  }

  let prevDay = "";

  return (
    <ScrollShadow className="min-h-0 flex-1 px-4 py-3">
      {hasMore && (
        <div className="mb-2 flex justify-center">
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={loadingOlder}
            className="rounded-full bg-default-100 px-3 py-1 text-xs text-default-500 hover:bg-default-200 disabled:opacity-60"
          >
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        </div>
      )}

      {messages.map((m) => {
        const k = dayKey(m.createdAt);
        const showDay = k !== prevDay;
        prevDay = k;
        return (
          <div key={m.id}>
            {showDay && (
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-default-100 px-3 py-0.5 text-[11px] font-medium text-default-500">
                  {formatDaySeparator(m.createdAt)}
                </span>
              </div>
            )}
            <Bubble message={m} />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </ScrollShadow>
  );
}

function Bubble({ message: m }: { message: TwilioMessage }) {
  const outbound = m.direction === "outbound";
  const kind = outbound ? statusKind(m.status) : "none";
  const failed = kind === "failed";

  return (
    <div className={clsx("mb-1.5 flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          outbound
            ? failed
              ? "bg-danger-100 text-danger-700 rounded-br-md"
              : "bg-primary text-primary-foreground rounded-br-md"
            : "bg-default-100 text-foreground rounded-bl-md",
        )}
      >
        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}

        {/* MMS media (links only; superadmin authenticated) */}
        {m.mediaUrls && m.mediaUrls.length > 0 && (
          <div className="mt-1 flex flex-col gap-1">
            {m.mediaUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className={clsx(
                  "truncate text-xs underline",
                  outbound ? "text-primary-foreground/90" : "text-primary",
                )}
              >
                Attachment {i + 1}
              </a>
            ))}
          </div>
        )}

        <div
          className={clsx(
            "mt-0.5 flex items-center gap-1 text-[10px]",
            outbound
              ? failed
                ? "justify-end text-danger-500"
                : "justify-end text-primary-foreground/70"
              : "justify-start text-default-400",
          )}
        >
          <Tooltip content={formatRelative(m.createdAt)} delay={400} closeDelay={0}>
            <span>{formatBubbleTime(m.createdAt)}</span>
          </Tooltip>
          {outbound && <StatusTick kind={kind} error={m.errorMessage} />}
        </div>
      </div>
    </div>
  );
}

function StatusTick({
  kind,
  error,
}: {
  kind: ReturnType<typeof statusKind>;
  error?: string | null;
}) {
  if (kind === "sending") return <Clock className="h-3 w-3" aria-label="Sending" />;
  if (kind === "sent") return <Check className="h-3 w-3" aria-label="Sent" />;
  if (kind === "delivered")
    return <CheckCheck className="h-3 w-3" aria-label="Delivered" />;
  if (kind === "failed")
    return (
      <Tooltip content={error || "Failed to deliver"} color="danger" delay={200}>
        <AlertCircle className="h-3 w-3" aria-label="Failed" />
      </Tooltip>
    );
  return null;
}

export default MessageThread;
