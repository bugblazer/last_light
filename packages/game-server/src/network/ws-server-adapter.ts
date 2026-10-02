import { IServerAdapter } from "@shared/network/server-adapter";
import { ISocketAdapter } from "@shared/network/socket-adapter";
import { UWebSocketsSocketAdapter } from "./uwebsockets-socket-adapter";
import { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket, RawData } from "ws";

/**
 * Pure-JavaScript WebSocket server adapter built on the `ws` package.
 *
 * It speaks exactly the same wire protocol as the uWebSockets adapter
 * ([1-byte event id][binary payload] or JSON text frames), so the browser
 * client's native-WebSocket adapter works against it unchanged.
 *
 * Used by the LAN / offline build, where shipping the native uWebSockets.js
 * binary inside a single Windows executable is not practical. Because it
 * attaches to a regular Node HTTP server, the same port can also serve the
 * game's static files.
 */
let activeConnections = 0;

/** Number of currently open WebSocket connections across all ws adapters. */
export function getActiveWsConnectionCount(): number {
  return activeConnections;
}

export class WsServerAdapter implements IServerAdapter {
  private wss: WebSocketServer;
  private socketAdapters: Map<string, ISocketAdapter> = new Map();
  private connectionHandlers: Array<(socket: ISocketAdapter) => void> = [];
  private nextSocketId = 0;

  constructor(private httpServer: HttpServer) {
    this.wss = new WebSocketServer({
      server: httpServer,
      maxPayload: 16 * 1024 * 1024,
      perMessageDeflate: false,
    });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const queryParams = parseQuery(req.url || "");
      const socketId = `ws_${++this.nextSocketId}_${Date.now()}`;

      // Shim that exposes the subset of the uWS WebSocket API the socket adapter uses.
      const shim = {
        send: (message: ArrayBuffer | string, isBinary?: boolean) => {
          if (ws.readyState !== WebSocket.OPEN) return 0;
          if (typeof message === "string") {
            ws.send(message, { binary: false });
          } else {
            ws.send(Buffer.from(message), { binary: isBinary !== false });
          }
          return 1;
        },
        close: () => ws.terminate(),
        end: (code?: number) => ws.close(code ?? 1000),
      };

      const adapter = new UWebSocketsSocketAdapter(shim as any, socketId, queryParams);
      this.socketAdapters.set(socketId, adapter);
      activeConnections++;

      // Keep idle connections healthy (mirrors uWS idleTimeout behaviour).
      let alive = true;
      ws.on("pong", () => (alive = true));
      const heartbeat = setInterval(() => {
        if (!alive) {
          ws.terminate();
          return;
        }
        alive = false;
        try {
          ws.ping();
        } catch {
          /* ignore */
        }
      }, 15000);

      ws.on("message", (data: RawData, isBinary: boolean) => {
        if (isBinary) {
          const buf = Array.isArray(data)
            ? Buffer.concat(data)
            : Buffer.isBuffer(data)
              ? data
              : Buffer.from(data as ArrayBuffer);
          const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          adapter.handleMessage(arrayBuffer as ArrayBuffer);
        } else {
          adapter.handleMessage(data.toString());
        }
      });

      ws.on("close", () => {
        clearInterval(heartbeat);
        activeConnections = Math.max(0, activeConnections - 1);
        if (this.socketAdapters.delete(socketId)) {
          adapter.triggerEvent("disconnect");
        }
      });

      ws.on("error", (err) => {
        console.error(`WebSocket error on ${socketId}:`, err.message);
      });

      for (const handler of this.connectionHandlers) {
        try {
          handler(adapter);
        } catch (error) {
          console.error("Error in connection handler:", error);
        }
      }
    });
  }

  on(event: string, listener: (...args: any[]) => void): this {
    if (event === "connection") {
      this.connectionHandlers.push(listener as (socket: ISocketAdapter) => void);
    } else {
      console.warn(`WsServerAdapter: Event '${event}' not supported`);
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    let successCount = 0;
    this.socketAdapters.forEach((adapter) => {
      if (adapter.emit(event, ...args)) successCount++;
    });
    return successCount > 0;
  }

  listen(port: number, callback?: () => void): void {
    this.httpServer.listen(port, "0.0.0.0", () => callback?.());
  }

  get sockets(): { size: number; sockets: Map<string, ISocketAdapter> } {
    return { size: this.socketAdapters.size, sockets: this.socketAdapters };
  }
}

function parseQuery(url: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const idx = url.indexOf("?");
  if (idx === -1) return out;
  const params = new URLSearchParams(url.slice(idx + 1));
  for (const [key, value] of params.entries()) {
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return out;
}
