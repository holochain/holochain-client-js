import { decode, encode } from "@msgpack/msgpack";
import Emittery from "emittery";
import IsoWebSocket from "isomorphic-ws";
import { HolochainError, WsClientOptions } from "./common.js";
import { AppAuthenticationToken } from "./admin/index.js";
import { AppSignal, RawSignal, Signal, SignalType } from "./app/index.js";
import { encodeHashToBase64 } from "../utils/base64.js";

interface HolochainMessage {
  id: number;
  type: "response" | "signal";
  data: ArrayLike<number> | null;
}

type RequestResolver = (msg: unknown) => ReturnType<typeof decode>;
type RequestRejecter = (error: Error) => void;

interface HolochainRequest {
  resolve: RequestResolver;
  reject: RequestRejecter;
}

/**
 * @public
 */
export interface AppAuthenticationRequest {
  token: AppAuthenticationToken;
}

/**
 * A WebSocket client which can make requests and receive responses,
 * as well as send and receive signals.
 *
 * Uses Holochain's WireMessage for communication.
 *
 * @public
 */
export class WsClient extends Emittery {
  socket: IsoWebSocket;
  url: URL | undefined;
  options: WsClientOptions | undefined;
  private pendingRequests: Record<number, HolochainRequest>;
  private index: number;
  private authenticationToken: AppAuthenticationToken | undefined;
  private reconnectPromise: Promise<void> | undefined;

  constructor(socket: IsoWebSocket, url?: URL, options?: WsClientOptions) {
    super();
    this.registerMessageListener(socket);
    this.registerCloseListener(socket);
    this.socket = socket;
    this.url = url;
    this.options = options;
    this.pendingRequests = {};
    this.index = 0;
  }

  /**
   * Instance factory for creating WsClients.
   *
   * @param url - The WebSocket URL to connect to.
   * @param options - Options for the WsClient.
   * @returns An new instance of the WsClient.
   */
  static connect(url: URL, options?: WsClientOptions) {
    return new Promise<WsClient>((resolve, reject) => {
      const socket = new IsoWebSocket(url, options);
      socket.addEventListener("error", (errorEvent) => {
        reject(
          new HolochainError(
            "ConnectionError",
            `could not connect to Holochain Conductor API at ${url} - ${errorEvent.error}`,
          ),
        );
      });
      socket.addEventListener(
        "open",
        () => {
          const client = new WsClient(socket, url, options);
          resolve(client);
        },
        { once: true },
      );
    });
  }

  /**
   * Sends data as a signal.
   *
   * @param data - Data to send.
   */
  emitSignal(data: unknown) {
    const encodedMsg = encode({
      type: "signal",
      data: encode(data),
    });
    this.socket.send(encodedMsg);
  }

  /**
   * Authenticate the client with the conductor.
   *
   * This is only relevant for app websockets.
   *
   * @param request - The authentication request, containing an app authentication token.
   */
  async authenticate(request: AppAuthenticationRequest): Promise<void> {
    this.authenticationToken = request.token;
    return this.exchange(request, (request, resolve, reject) => {
      const invalidTokenCloseListener = (
        closeEvent: IsoWebSocket.CloseEvent,
      ) => {
        this.authenticationToken = undefined;
        reject(
          new HolochainError(
            "InvalidTokenError",
            `could not connect to ${this.url} due to an invalid app authentication token - close code ${closeEvent.code}`,
          ),
        );
      };
      this.socket.addEventListener("close", invalidTokenCloseListener, {
        once: true,
      });
      const encodedMsg = encode({
        type: "authenticate",
        data: encode(request),
      });
      this.socket.send(encodedMsg);
      // Wait before resolving in case authentication fails.
      setTimeout(() => {
        this.socket.removeEventListener("close", invalidTokenCloseListener);
        resolve(null);
      }, 10);
    });
  }

  /**
   * Close the websocket connection.
   */
  close(code = 1000) {
    const closedPromise = new Promise<IsoWebSocket.CloseEvent>((resolve) =>
      this.socket.addEventListener(
        "close",
        (closeEvent) => resolve(closeEvent),
        { once: true },
      ),
    );
    this.socket.close(code);
    return closedPromise;
  }

  /**
   * Send requests to the connected websocket.
   *
   * If the underlying socket is closed when this method is called, the
   * client transparently reconnects and re-authenticates using the cached
   * token. Transient reconnect errors are surfaced as a `ConnectionError`
   * and the cached token is retained, so a subsequent call can retry the
   * reconnect.
   *
   * If the conductor rejects the cached token during the reconnect
   * (signalled by an immediate close after the `authenticate` handshake),
   * the cached token is cleared and the call rejects with an
   * `InvalidTokenError`. The consumer must rebuild the `AppWebsocket`
   * with a fresh token; further calls on this client will reject with
   * `WebsocketClosedError`.
   *
   * @param request - The request to send over the websocket.
   * @returns The decoded response payload.
   */
  async request<Response>(request: unknown): Promise<Response> {
    return this.exchange(request, this.sendMessage.bind(this));
  }

  private async exchange<Response>(
    request: unknown,
    sendHandler: (
      request: unknown,
      resolve: RequestResolver,
      reject: RequestRejecter,
    ) => void,
  ): Promise<Response> {
    if (this.socket.readyState === this.socket.OPEN) {
      const promise = new Promise((resolve, reject) => {
        sendHandler(request, resolve, reject);
      });
      return promise as Promise<Response>;
    } else if (this.url && this.authenticationToken) {
      // Dedupe concurrent reconnect attempts. The first caller into this
      // branch starts a single reconnect; further callers await the same
      // promise so we never create multiple sockets in parallel.
      if (!this.reconnectPromise) {
        this.reconnectPromise = this.reconnectWebsocket(
          this.url,
          this.authenticationToken,
        ).finally(() => {
          this.reconnectPromise = undefined;
        });
      }
      await this.reconnectPromise;
      this.registerMessageListener(this.socket);
      this.registerCloseListener(this.socket);
      const promise = new Promise((resolve, reject) =>
        sendHandler(request, resolve, reject),
      );
      return promise as Promise<Response>;
    } else {
      return Promise.reject(
        new HolochainError("WebsocketClosedError", "Websocket is not open"),
      );
    }
  }

  private sendMessage(
    request: unknown,
    resolve: RequestResolver,
    reject: RequestRejecter,
  ) {
    const id = this.index;
    const encodedMsg = encode({
      id,
      type: "request",
      data: encode(request),
    });
    this.socket.send(encodedMsg);
    this.pendingRequests[id] = { resolve, reject };
    this.index += 1;
  }

  private registerMessageListener(socket: IsoWebSocket) {
    socket.onmessage = async (serializedMessage) => {
      // If data is not a buffer (nodejs), it will be a blob (browser)
      let deserializedData;
      if (
        globalThis.window &&
        serializedMessage.data instanceof globalThis.window.Blob
      ) {
        deserializedData = await serializedMessage.data.arrayBuffer();
      } else {
        if (
          typeof Buffer !== "undefined" &&
          Buffer.isBuffer(serializedMessage.data)
        ) {
          deserializedData = serializedMessage.data;
        } else {
          throw new HolochainError(
            "UnknownMessageFormat",
            `incoming message has unknown message format - ${deserializedData}`,
          );
        }
      }

      const message = decode(deserializedData);
      assertHolochainMessage(message);

      if (message.type === "signal") {
        if (message.data === null) {
          throw new HolochainError(
            "UnknownSignalFormat",
            "incoming signal has no data",
          );
        }
        const deserializedSignal = decode(message.data);
        assertHolochainSignal(deserializedSignal);

        if (deserializedSignal.type === SignalType.System) {
          this.emit("signal", {
            type: SignalType.System,
            value: deserializedSignal.value,
          } as Signal);
        } else {
          const encodedAppSignal = deserializedSignal.value;

          // In order to return readable content to the UI, the signal payload must also be deserialized.
          const payload = decode(encodedAppSignal.signal);

          const signal: AppSignal = {
            cell_id: encodedAppSignal.cell_id,
            zome_name: encodedAppSignal.zome_name,
            payload,
          };
          this.emit("signal", {
            type: SignalType.App,
            value: signal,
          } as Signal);
        }
      } else if (message.type === "response") {
        this.handleResponse(message);
      } else {
        throw new HolochainError(
          "UnknownMessageType",
          `incoming message has unknown type - ${message.type}`,
        );
      }
    };
  }

  private registerCloseListener(socket: IsoWebSocket) {
    socket.addEventListener(
      "close",
      (closeEvent) => {
        const pendingRequestIds = Object.keys(this.pendingRequests).map((id) =>
          parseInt(id),
        );
        if (pendingRequestIds.length) {
          pendingRequestIds.forEach((id) => {
            const error = new HolochainError(
              "ClientClosedWithPendingRequests",
              `client closed with pending requests - close event code: ${closeEvent.code}, request id: ${id}`,
            );
            this.pendingRequests[id].reject(error);
            delete this.pendingRequests[id];
          });
        }
      },
      { once: true },
    );
  }

  private async reconnectWebsocket(url: URL, token: AppAuthenticationToken) {
    return new Promise<void>((resolve, reject) => {
      this.socket = new IsoWebSocket(url, this.options);

      // Track whether the "open" event has fired. The invalidTokenCloseListener
      // must only clear the token when the connection did open and the conductor
      // then closed it quickly.
      let openFired = false;

      // This error event never occurs in tests. Could be removed?
      this.socket.addEventListener(
        "error",
        (errorEvent) => {
          reject(
            new HolochainError(
              "ConnectionError",
              `could not connect to Holochain Conductor API at ${url} - ${errorEvent.message}`,
            ),
          );
        },
        { once: true },
      );

      const invalidTokenCloseListener = (
        closeEvent: IsoWebSocket.CloseEvent,
      ) => {
        if (openFired) {
          this.authenticationToken = undefined;
          reject(
            new HolochainError(
              "InvalidTokenError",
              `could not connect to ${this.url} due to an invalid app authentication token - close code ${closeEvent.code}`,
            ),
          );
        } else {
          reject(
            new HolochainError(
              "ConnectionError",
              `could not connect to Holochain Conductor API at ${url} - close code ${closeEvent.code}`,
            ),
          );
        }
      };
      this.socket.addEventListener("close", invalidTokenCloseListener, {
        once: true,
      });

      this.socket.addEventListener(
        "open",
        async () => {
          openFired = true;
          const encodedMsg = encode({
            type: "authenticate",
            data: encode({ token }),
          });
          this.socket.send(encodedMsg);
          // Wait in case authentication fails.
          setTimeout(() => {
            this.socket.removeEventListener("close", invalidTokenCloseListener);
            resolve();
          }, 10);
        },
        { once: true },
      );
    });
  }

  private handleResponse(msg: HolochainMessage) {
    const id = msg.id;
    if (this.pendingRequests[id]) {
      if (msg.data === null || msg.data === undefined) {
        this.pendingRequests[id].reject(
          new Error("Response canceled by responder"),
        );
      } else {
        this.pendingRequests[id].resolve(
          decode(msg.data, {
            mapKeyConverter: (key: unknown) => {
              if (typeof key === "string" || typeof key === "number") {
                return key;
              }
              if (key && typeof key === "object" && key instanceof Uint8Array) {
                // Key of type byte array, must be a HoloHash.
                return encodeHashToBase64(key);
              }
              throw new HolochainError(
                "DeserializationError",
                "Encountered map with key of type 'object', but not HoloHash " +
                  key,
              );
            },
          }),
        );
      }
      delete this.pendingRequests[id];
    } else {
      console.error(
        `got response with no matching request. id = ${id} msg = ${msg}`,
      );
    }
  }
}

function assertHolochainMessage(
  message: unknown,
): asserts message is HolochainMessage {
  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    "data" in message
  ) {
    return;
  }
  throw new HolochainError(
    "UnknownMessageFormat",
    `incoming message has unknown message format ${JSON.stringify(
      message,
      null,
      4,
    )}`,
  );
}

function assertHolochainSignal(signal: unknown): asserts signal is RawSignal {
  if (
    typeof signal === "object" &&
    signal !== null &&
    "type" in signal &&
    "value" in signal &&
    [SignalType.App, SignalType.System].some((type) => signal.type === type)
  ) {
    return;
  }
  throw new HolochainError(
    "UnknownSignalFormat",
    `incoming signal has unknown signal format ${JSON.stringify(
      signal,
      null,
      4,
    )}`,
  );
}

export { IsoWebSocket };
