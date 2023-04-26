import nodeWs from "ws";

/**
 * Isomorphic wrapper around WebSocket for compatiblity with Nodejs and Web API.
 *
 * @public
 */
const IsoWebSocket = globalThis.window ? globalThis.window.WebSocket : nodeWs;
export { IsoWebSocket };
export type IsoWebSocket = InstanceType<
  typeof globalThis.WebSocket | typeof nodeWs
>;
