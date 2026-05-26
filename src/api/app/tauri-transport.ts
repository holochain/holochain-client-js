import { decode, encode } from "@msgpack/msgpack";
import Emittery from "emittery";
import {
  getTauriHolochainEnvironment,
  getTauriInvoke,
} from "../../environments/tauri.js";
import { encodeHashToBase64 } from "../../utils/base64.js";
import { HolochainError } from "../common.js";
import {
  AppClientTransport,
  AppSignal,
  RawSignal,
  Signal,
  SignalType,
} from "./types.js";

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
  private readonly unsubscribeSignals?: () => void;

  constructor(pluginName: string) {
    super();
    this.command = `plugin:${pluginName}|app_request`;

    // Subscribe to the plugin's signal bridge (if injected) and re-emit each
    // signal on this Emittery, so `AppWebsocket.on("signal", ...)` works exactly
    // as it does over a websocket.
    const env = getTauriHolochainEnvironment();
    this.unsubscribeSignals = env?.subscribeSignals?.((bytes) =>
      this.handleSignalBytes(bytes),
    );
  }

  /** Stop receiving signals. */
  close() {
    this.unsubscribeSignals?.();
  }

  /**
   * Decode a signal delivered by the plugin and emit it. The bytes are the same
   * the websocket carries, so this mirrors `WsClient`'s signal handling
   * (src/api/client.ts): app signals have their inner payload decoded; system
   * signals pass through.
   */
  private handleSignalBytes(bytes: Uint8Array) {
    const raw = decode(bytes) as RawSignal;
    if (raw.type === SignalType.System) {
      this.emit("signal", { type: SignalType.System, value: raw.value }).catch(
        console.error,
      );
      return;
    }
    const encodedAppSignal = raw.value;
    const signal: AppSignal = {
      cell_id: encodedAppSignal.cell_id,
      zome_name: encodedAppSignal.zome_name,
      payload: decode(encodedAppSignal.signal),
    };
    this.emit("signal", {
      type: SignalType.App,
      value: signal,
    } as Signal).catch(console.error);
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
