import { useCallback, useEffect, useRef, useState } from "react";
import { Button, useDisclosure } from "@heroui/react";
import { ArrowLeft, MessageSquare, RefreshCw } from "lucide-react";
import { clsx } from "clsx";

import twilioService, {
  type TwilioConversation,
  type TwilioMessage,
} from "@/services/twilio";
import { useSocketEvent } from "@/lib/socket";

import { ConversationList } from "./components/ConversationList";
import { MessageThread } from "./components/MessageThread";
import { Composer } from "./components/Composer";
import { NewMessageModal } from "./components/NewMessageModal";
import { formatPhone } from "./utils";

/** Socket payload shapes (must match backend src/lib/realtime emitSuperadminEvent). */
interface SmsInboundEvt {
  conversationId: string;
  message: TwilioMessage;
}
interface SmsOutboundEvt {
  conversationId: string;
  message: TwilioMessage;
}
interface SmsStatusEvt {
  twilioSid: string;
  status: string;
}

const CONV_LIMIT = 50;

/**
 * Platform SMS inbox for the SuperAdmin phone center.
 *
 * - Conversation list (peer, preview, unread badge, time)
 * - Message thread + composer (POST /twilio/messages)
 * - Realtime via socket: twilio:sms:inbound | :outbound | :status
 * - Marks a conversation read on open (POST /conversations/:id/read)
 *
 * Rendered standalone (route) or beside the softphone in PhoneCenter; fills the
 * height of its parent container (the parent sets a fixed h-* on lg screens).
 */
export function SmsInbox({ compact = false }: { compact?: boolean } = {}) {
  const [conversations, setConversations] = useState<TwilioConversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TwilioMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgPage, setMsgPage] = useState(1);
  const [msgTotal, setMsgTotal] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);

  const newMsg = useDisclosure();

  // Keep a ref to the active id so socket handlers read the freshest value.
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const active = conversations.find((c) => c.id === activeId) || null;

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    try {
      const res = await twilioService.conversations.list({ limit: CONV_LIMIT });
      setConversations(sortConversations(res.rows));
    } catch {
      // Axios interceptor already toasts; keep the inbox usable.
    } finally {
      setConvLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMsgLoading(true);
    setMsgPage(1);
    try {
      const res = await twilioService.conversations.messages(conversationId, {
        page: 1,
      });
      setMessages(sortMessagesAsc(res.rows));
      setMsgTotal(res.total);
    } catch {
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  }, []);

  const loadOlder = useCallback(async () => {
    if (!activeId || loadingOlder) return;
    const next = msgPage + 1;
    setLoadingOlder(true);
    try {
      const res = await twilioService.conversations.messages(activeId, {
        page: next,
      });
      setMessages((prev) => mergeMessages(sortMessagesAsc(res.rows), prev));
      setMsgPage(next);
      setMsgTotal(res.total);
    } catch {
      /* toast handled upstream */
    } finally {
      setLoadingOlder(false);
    }
  }, [activeId, msgPage, loadingOlder]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Open / select a conversation ─────────────────────────────────────────────

  const openConversation = useCallback(
    async (c: TwilioConversation) => {
      setActiveId(c.id);
      await loadMessages(c.id);
      if (c.unreadCount > 0) {
        // Optimistically clear the badge, then persist.
        setConversations((prev) =>
          prev.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)),
        );
        twilioService.conversations.markRead(c.id).catch(() => {
          /* best-effort */
        });
      }
    },
    [loadMessages],
  );

  // ── Realtime: inbound ────────────────────────────────────────────────────────

  useSocketEvent<SmsInboundEvt>("twilio:sms:inbound", (evt) => {
    const { conversationId, message } = evt;
    const isActive = activeIdRef.current === conversationId;

    if (isActive) {
      setMessages((prev) => upsertMessage(prev, message));
    }

    setConversations((prev) =>
      bumpConversation(prev, conversationId, message, {
        incrementUnread: !isActive,
      }),
    );

    if (isActive) {
      twilioService.conversations.markRead(conversationId).catch(() => {});
    }
    // App-wide notification (toast/sound/badge) is handled by PhoneProvider so it
    // works on any page and never double-fires.
  });

  // ── Realtime: outbound (sync across tabs/devices) ────────────────────────────

  useSocketEvent<SmsOutboundEvt>("twilio:sms:outbound", (evt) => {
    const { conversationId, message } = evt;
    if (activeIdRef.current === conversationId) {
      setMessages((prev) => upsertMessage(prev, message));
    }
    setConversations((prev) =>
      bumpConversation(prev, conversationId, message, { incrementUnread: false }),
    );
  });

  // ── Realtime: delivery status ────────────────────────────────────────────────

  useSocketEvent<SmsStatusEvt>("twilio:sms:status", (evt) => {
    const { twilioSid, status } = evt;
    setMessages((prev) =>
      prev.map((m) => (m.twilioSid === twilioSid ? { ...m, status } : m)),
    );
  });

  // ── Send ────────────────────────────────────────────────────────────────────

  const sendToActive = useCallback(
    async (body: string) => {
      if (!active) return;
      setSending(true);
      try {
        const res = await twilioService.sendMessage({ to: active.peerNumber, body });
        setMessages((prev) => upsertMessage(prev, res.message));
        setConversations((prev) =>
          bumpConversation(prev, res.conversationId, res.message, {
            incrementUnread: false,
          }),
        );
      } finally {
        setSending(false);
      }
    },
    [active],
  );

  const sendNew = useCallback(
    async (to: string, body: string) => {
      setSending(true);
      try {
        const res = await twilioService.sendMessage({ to, body });
        setConversations((prev) =>
          bumpConversation(prev, res.conversationId, res.message, {
            incrementUnread: false,
          }),
        );
        newMsg.onClose();
        setActiveId(res.conversationId);
        await loadMessages(res.conversationId);
      } finally {
        setSending(false);
      }
    },
    [newMsg, loadMessages],
  );

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filtered = search.trim()
    ? conversations.filter((c) =>
        normalizeSearch(c.peerNumber).includes(normalizeSearch(search)),
      )
    : conversations;

  const hasMoreMessages = messages.length < msgTotal;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-large border border-default-200 bg-content1 shadow-sm">
      {/* Conversation list — hidden on mobile when a thread is open */}
      <div
        className={clsx(
          "h-full w-full shrink-0",
          compact ? "" : "sm:w-72 md:w-80",
          activeId ? (compact ? "hidden" : "hidden sm:flex") : "flex",
        )}
      >
        <ConversationList
          conversations={filtered}
          activeId={activeId}
          loading={convLoading}
          search={search}
          onSearch={setSearch}
          onSelect={openConversation}
          onNew={newMsg.onOpen}
        />
      </div>

      {/* Thread pane */}
      <div
        className={clsx(
          "h-full min-w-0 flex-1 flex-col",
          activeId ? "flex" : compact ? "hidden" : "hidden sm:flex",
        )}
      >
        {active ? (
          <>
            <div className="flex items-center gap-2 border-b border-default-200 px-3 py-2.5">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className={compact ? "" : "sm:hidden"}
                aria-label="Back"
                onPress={() => setActiveId(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-default-200 text-sm font-semibold text-default-600">
                {active.peerNumber.replace(/[^\d]/g, "").slice(-2) || "#"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {formatPhone(active.peerNumber)}
                </p>
                {active.ourNumber && (
                  <p className="truncate text-[11px] text-default-400">
                    via {formatPhone(active.ourNumber)}
                  </p>
                )}
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label="Refresh thread"
                onPress={() => loadMessages(active.id)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <MessageThread
              messages={messages}
              loading={msgLoading}
              loadingOlder={loadingOlder}
              hasMore={hasMoreMessages}
              onLoadOlder={loadOlder}
            />

            <Composer disabled={sending} sending={sending} onSend={sendToActive} />
          </>
        ) : (
          <EmptyThread onNew={newMsg.onOpen} />
        )}
      </div>

      <NewMessageModal
        isOpen={newMsg.isOpen}
        onClose={newMsg.onClose}
        sending={sending}
        onSend={sendNew}
      />
    </div>
  );
}

function EmptyThread({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-default-400">
      <MessageSquare className="h-10 w-10" />
      <p className="text-sm">Select a conversation or start a new one.</p>
      <Button size="sm" color="primary" variant="flat" onPress={onNew}>
        New message
      </Button>
    </div>
  );
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

function normalizeSearch(v: string): string {
  return v.replace(/[^\d]/g, "");
}

function sortConversations(rows: TwilioConversation[]): TwilioConversation[] {
  return [...rows].sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt));
}

function sortMessagesAsc(rows: TwilioMessage[]): TwilioMessage[] {
  return [...rows].sort((a, b) => time(a.createdAt) - time(b.createdAt));
}

function time(v: string | null | undefined): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}

/** Insert or update a message by id (reconciling by twilioSid when present). */
function upsertMessage(list: TwilioMessage[], msg: TwilioMessage): TwilioMessage[] {
  const idx = list.findIndex(
    (m) => m.id === msg.id || (!!msg.twilioSid && m.twilioSid === msg.twilioSid),
  );
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = { ...next[idx], ...msg };
    return next;
  }
  return sortMessagesAsc([...list, msg]);
}

/** Merge an older page (asc) before the current tail, de-duping by id. */
function mergeMessages(
  older: TwilioMessage[],
  current: TwilioMessage[],
): TwilioMessage[] {
  const seen = new Set(current.map((m) => m.id));
  const merged = [...older.filter((m) => !seen.has(m.id)), ...current];
  return sortMessagesAsc(merged);
}

/**
 * Move a conversation to the top, refresh preview/time, and (optionally) bump
 * unread. If the conversation is unknown (e.g. a brand-new inbound thread),
 * synthesize a row from the message so it appears immediately; a later list
 * refresh fills in canonical fields.
 */
function bumpConversation(
  list: TwilioConversation[],
  conversationId: string,
  msg: TwilioMessage,
  opts: { incrementUnread: boolean },
): TwilioConversation[] {
  const idx = list.findIndex((c) => c.id === conversationId);
  if (idx >= 0) {
    const existing = list[idx];
    const updated: TwilioConversation = {
      ...existing,
      lastMessageAt: msg.createdAt,
      lastMessagePreview: previewOf(msg),
      unreadCount: opts.incrementUnread
        ? existing.unreadCount + 1
        : existing.unreadCount,
    };
    const rest = list.filter((_, i) => i !== idx);
    return [updated, ...rest];
  }

  // Unknown conversation → synthesize a placeholder row.
  const peer = msg.direction === "inbound" ? msg.fromNumber : msg.toNumber;
  const our = msg.direction === "inbound" ? msg.toNumber : msg.fromNumber;
  const synth: TwilioConversation = {
    id: conversationId,
    peerNumber: peer,
    ourNumber: our,
    lastMessageAt: msg.createdAt,
    lastMessagePreview: previewOf(msg),
    unreadCount: opts.incrementUnread ? 1 : 0,
    status: "open",
    createdAt: msg.createdAt,
    updatedAt: msg.createdAt,
  };
  return [synth, ...list];
}

function previewOf(msg: TwilioMessage): string {
  if (msg.body) return msg.body.slice(0, 140);
  if (msg.mediaUrls && msg.mediaUrls.length) return "Attachment";
  return "";
}

export default SmsInbox;
