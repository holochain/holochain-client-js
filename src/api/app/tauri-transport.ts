import { decode, encode } from "@msgpack/msgpack";
import Emittery from "emittery";
import { getTauriInvoke } from "../../environments/tauri.js";
import { encodeHashToBase64 } from "../../utils/base64.js";
import { HolochainError } from "../common.js";
import { AppClientTransport } from "./types.js";

/**
 * Carries the App API over Tauri IPC into a Holochain conductor running in the
 * same process, instead of over a websocket.
 *
 * From {@link AppWebsocket}'s perspective this is a drop-in for
 * {@link WsClient}: it exposes the same `request` method and is an Emittery
 * that emits `signal` events, so every AppWebsocket method works unchanged.
 * Only the pipe differs — the same msgpack-encoded `{ type, value }` payloads a
 * websocket would carry are sent through the `plugin:<name>|app_request`
 * command. No app id is sent: the conductor scopes each request to the calling
 * window on the Rust side, which replaces the per-app websocket auth token.
 *
 * @public
 */
export class TauriAppTransport extends Emittery implements AppClientTransport {
  private readonly command: string;

  constructor(pluginName: string) {
    super();
    this.command = `plugin:${pluginName}|app_request`;
  }

  /**
   * Send a tagged App API request through Tauri IPC and return the tagged
   * response. The bytes on the wire are identical to the websocket path.
   *
   * @param request - The tagged `{ type, value }` App API request.
   * @returns The decoded tagged App API response.
   */
  async request<Response>(request: unknown): Promise<Response> {
    const invoke = getTauriInvoke();
    const requestBytes = Array.from(encode(request));
    const responseBytes = await invoke<number[]>(this.command, {
      request: requestBytes,
    });
    return decode(Uint8Array.from(responseBytes), {
      mapKeyConverter,
    }) as Response;
  }
}

/**
 * Convert msgpack map keys exactly as the websocket client does: byte-array
 * keys are HoloHashes and are returned in their Base64 string form. Mirrors the
 * converter in `WsClient.handleResponse` (src/api/client.ts) so decoded
 * responses match the websocket path byte for byte.
 */
const mapKeyConverter = (key: unknown) => {
  if (typeof key === "string" || typeof key === "number") {
    return key;
  }
  if (key && typeof key === "object" && key instanceof Uint8Array) {
    return encodeHashToBase64(key);
  }
  throw new HolochainError(
    "DeserializationError",
    "Encountered map with key of type 'object', but not HoloHash " + key,
  );
};
