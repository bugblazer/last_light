import { IServerAdapter } from "@shared/network/server-adapter";
import { SocketIOServerAdapter } from "./socketio-server-adapter";
import { UWebSocketsServerAdapter } from "./uwebsockets-server-adapter";
import { WsServerAdapter } from "./ws-server-adapter";
import { Server as HttpServer } from "http";
import { getConfig } from "@shared/config";

/**
 * Create the appropriate server adapter based on configuration
 */
export function createServerAdapter(
  httpServer: HttpServer,
  corsOptions?: { origin: string | string[]; methods: string[] }
): IServerAdapter {
  const implementation = getConfig().network.WEBSOCKET_IMPLEMENTATION;

  if (implementation === "ws") {
    return new WsServerAdapter(httpServer);
  } else if (implementation === "uwebsockets") {
    return new UWebSocketsServerAdapter(httpServer, corsOptions);
  } else {
    // Default to Socket.IO
    return new SocketIOServerAdapter(httpServer, corsOptions);
  }
}

