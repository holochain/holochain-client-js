import { decode, encode } from "@msgpack/msgpack";
import Emittery from "emittery";
import {
  getTauriHolochainEnvironment,
  getTauriInvoke,
} from "../../environments/tauri.js";
import { decodeSignal, holoHashMapKeyConverter } from "./decode.js";
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

  /**
   * Stop receiving signals.
   *
   * Not reachable through {@link AppClientTransport} (the public transport
   * surface is `request` + `on`), and {@link AppWebsocket} exposes no app-level
   * disconnect — same as the websocket path. In practice the subscription lives
   * for the lifetime of the webview. This is kept for explicit teardown in
   * tests and any future wiring of a disconnect through the interface.
   */
  close() {
    this.unsubscribeSignals?.();
  }

  /**
   * Decode a signal delivered by the plugin and emit it. The bytes are the same
   * the websocket carries, so this reuses the shared `decodeSignal` helper
   * (src/api/app/decode.ts): app signals have their inner payload decoded;
   * system signals pass through. Malformed signals throw, exactly as on the
   * websocket path.
   */
  private handleSignalBytes(bytes: Uint8Array) {
    this.emit("signal", decodeSignal(decode(bytes))).catch(console.error);
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
      mapKeyConverter: holoHashMapKeyConverter,
    }) as Response;
  }
}
