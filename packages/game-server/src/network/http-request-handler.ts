import type { IncomingMessage, ServerResponse } from "http";

export type HttpRequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Optional HTTP handler for the game server's HTTP port.
 *
 * By default the game server answers every plain HTTP request with 404.
 * The LAN build registers a handler here (before creating the GameServer)
 * so the same port also serves the game client's static files.
 */
let customHandler: HttpRequestHandler | null = null;

export function setHttpRequestHandler(handler: HttpRequestHandler | null): void {
  customHandler = handler;
}

export function getHttpRequestHandler(): HttpRequestHandler | null {
  return customHandler;
}
