import { Badge, Button, Input, ScrollShadow, Spinner } from "@heroui/react";
import { MessageSquarePlus, Search } from "lucide-react";
import { clsx } from "clsx";

import type { TwilioConversation } from "@/services/twilio";
import { formatConversationTime, formatPhone } from "../utils";

interface Props {
  conversations: TwilioConversation[];
  activeId: string | null;
  loading?: boolean;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (c: TwilioConversation) => void;
  onNew: () => void;
}

export function ConversationList({
  conversations,
  activeId,
  loading,
  search,
  onSearch,
  onSelect,
  onNew,
}: Props) {
  return (
    <div className="flex h-full w-full flex-col border-r border-default-200 bg-content1">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-default-200 px-3 py-3">
        <Input
          aria-label="Search conversations"
          size="sm"
          variant="flat"
          placeholder="Search number…"
          value={search}
          onValueChange={onSearch}
          startContent={<Search className="h-4 w-4 text-default-400" />}
          isClearable
          onClear={() => onSearch("")}
        />
        <Button
          isIconOnly
          size="sm"
          color="primary"
          variant="flat"
          aria-label="New message"
          onPress={onNew}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      <ScrollShadow className="min-h-0 flex-1">
        {loading && !conversations.length ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner size="sm" color="primary" />
          </div>
        ) : !conversations.length ? (
          <div className="px-4 py-10 text-center text-sm text-default-400">
            No conversations yet.
          </div>
        ) : (
          <ul className="divide-y divide-default-100">
            {conversations.map((c) => {
              const active = c.id === activeId;
              const unread = c.unreadCount > 0;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    className={clsx(
                      "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors",
                      active ? "bg-primary/10" : "hover:bg-default-100",
                    )}
                  >
                    <Badge
                      color="danger"
                      content={c.unreadCount > 99 ? "99+" : c.unreadCount}
                      isInvisible={!unread}
                      placement="top-right"
                      size="sm"
                    >
                      <div
                        className={clsx(
                          "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-default-200 text-default-600",
                        )}
                      >
                        {initials(c.peerNumber)}
                      </div>
                    </Badge>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={clsx(
                            "truncate text-sm",
                            unread ? "font-semibold text-foreground" : "font-medium text-foreground",
                          )}
                        >
                          {formatPhone(c.peerNumber)}
                        </span>
                        <span className="shrink-0 text-[11px] text-default-400">
                          {formatConversationTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <p
                        className={clsx(
                          "mt-0.5 truncate text-xs",
                          unread ? "text-default-600" : "text-default-400",
                        )}
                      >
                        {c.lastMessagePreview || "No messages yet"}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollShadow>
    </div>
  );
}

/** Last two digits of the peer number as a cheap avatar label. */
function initials(peer: string): string {
  const digits = (peer || "").replace(/[^\d]/g, "");
  return digits.slice(-2) || "#";
}

export default ConversationList;
