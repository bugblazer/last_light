// Stand-in for the native uWebSockets.js module in the LAN build.
// The LAN build always uses the pure-JS "ws" adapter, so this is never called.
function notAvailable() {
  throw new Error("uWebSockets.js is not included in the LAN build (use WEBSOCKET_IMPLEMENTATION=ws).");
}
module.exports = { App: notAvailable, SSLApp: notAvailable, SHARED_COMPRESSOR: 0 };
