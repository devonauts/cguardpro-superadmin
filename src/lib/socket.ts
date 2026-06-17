import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getAuthToken } from "@/lib/api";

/**
 * Singleton socket.io client for the SuperAdmin panel.
 *
 * Connects same-origin at path '/api/socket.io' (matching the backend
 * src/lib/realtime.ts config), authenticating with the stored superadmin JWT.
 * The backend relaxes the handshake for superadmins, who connect to the
 * platform-scoped 'superadmin' room — so we pass a fixed tenantId of 'platform'.
 *
 * All platform phone-center realtime events (twilio:*) are delivered here.
 */
let socket: Socket | null = null;

/** Lazily create (and reuse) the shared socket. Reconnects automatically. */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(window.location.origin, {
    path: "/api/socket.io",
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: {
      token: getAuthToken() || "",
      tenantId: "platform",
    },
  });

  return socket;
}

/** Refresh the handshake auth (e.g. after a token change) and reconnect. */
export function refreshSocketAuth(): void {
  if (!socket) return;
  (socket.auth as Record<string, unknown>) = {
    token: getAuthToken() || "",
    tenantId: "platform",
  };
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
}

/** Tear down the shared socket (e.g. on sign-out). */
export function closeSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/**
 * React hook: subscribe to a socket event for the lifetime of the component.
 * The handler ref is kept current so callers needn't memoize it.
 */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const s = getSocket();
    const listener = (payload: T) => handlerRef.current(payload);
    s.on(event, listener);
    return () => {
      s.off(event, listener);
    };
  }, [event]);
}
