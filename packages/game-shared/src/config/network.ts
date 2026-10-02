/**
 * ========================================================================
 * NETWORK CONFIGURATION
 * ========================================================================
 *
 * Controls network behavior.
 * ========================================================================
 */

/**
 * - "uwebsockets": native uWebSockets.js server (production default)
 * - "ws": pure-JS `ws` server speaking the same wire protocol (LAN / offline build)
 * - "socketio": legacy Socket.IO transport
 *
 * Browsers always use the native WebSocket client, which works with both
 * "uwebsockets" and "ws" servers.
 */
export type WebSocketImplementation = "socketio" | "uwebsockets" | "ws";

const getWebSocketImplementation = (): WebSocketImplementation => {
  // Check environment variable first (server-side)
  if (typeof process !== "undefined" && process.env.WEBSOCKET_IMPLEMENTATION) {
    const impl = process.env.WEBSOCKET_IMPLEMENTATION.toLowerCase();
    if (impl === "socketio" || impl === "uwebsockets" || impl === "ws") {
      return impl;
    }
  }
  // Default to socketio for backward compatibility
  return "uwebsockets"; //"socketio";
};

export const networkConfig = {
  /**
   * WebSocket implementation to use: "socketio" or "uwebsockets"
   * Can be overridden via WEBSOCKET_IMPLEMENTATION environment variable
   */
  WEBSOCKET_IMPLEMENTATION: getWebSocketImplementation(),
} as const;

export type NetworkConfig = typeof networkConfig;
