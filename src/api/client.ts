import { decode, encode } from "@msgpack/msgpack";
import Emittery from "emittery";
import IsoWebSocket from "isomorphic-ws";
import { HolochainError, WsClientOptions } from "./common.js";
import { AppAuthenticationToken } from "./admin/index.js";
import { AppSignal, RawSignal, Signal, SignalType } from "./app/index.js";

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
  options: WsClientOptions;
  private pendingRequests: Record<number, HolochainRequest>;
  private index: number;
  private authenticationToken: AppAuthenticationToken | undefined;

  constructor(socket: IsoWebSocket, url?: URL, options?: WsClientOptions) {
    super();
    this.registerMessageListener(socket);
    this.registerCloseListener(socket);
    this.socket = socket;
    this.url = url;
    this.options = options || {};
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
            `could not connect to Holochain Conductor API at ${url} - ${errorEvent.error}`
          )
        );
      });
      socket.addEventListener(
        "open",
        (_) => {
          const client = new WsClient(socket, url, options);
          resolve(client);
        },
        { once: true }
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
        closeEvent: IsoWebSocket.CloseEvent
      ) => {
        this.authenticationToken = undefined;
        reject(
          new HolochainError(
            "InvalidTokenError",
            `could not connect to ${this.url} due to an invalid app authentication token - close code ${closeEvent.code}`
          )
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
        { once: true }
      )
    );
    this.socket.close(code);
    return closedPromise;
  }

  /**
   * Send requests to the connected websocket.
   *
   * @param request - The request to send over the websocket.
   * @returns
   */
  async request<Response>(request: unknown): Promise<Response> {
    return this.exchange(request, this.sendMessage.bind(this));
  }

  private async exchange<Response>(
    request: unknown,
    sendHandler: (
      request: unknown,
      resolve: RequestResolver,
      reject: RequestRejecter
    ) => void
  ): Promise<Response> {
    if (this.socket.readyState === this.socket.OPEN) {
      const promise = new Promise((resolve, reject) => {
        sendHandler(request, resolve, reject);
      });
      return promise as Promise<Response>;
    } else if (this.url && this.authenticationToken) {
      await this.reconnectWebsocket(this.url, this.authenticationToken);
      this.registerMessageListener(this.socket);
      this.registerCloseListener(this.socket);
      const promise = new Promise((resolve, reject) =>
        sendHandler(request, resolve, reject)
      );
      return promise as Promise<Response>;
    } else {
      return Promise.reject(
        new HolochainError("WebsocketClosedError", "Websocket is not open")
      );
    }
  }

  private sendMessage(
    request: unknown,
    resolve: RequestResolver,
    reject: RequestRejecter
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
            `incoming message has unknown message format - ${deserializedData}`
          );
        }
      }

      const message = decode(deserializedData);
      assertHolochainMessage(message);

      if (message.type === "signal") {
        if (message.data === null) {
          throw new HolochainError(
            "UnknownSignalFormat",
            "incoming signal has no data"
          );
        }
        const deserializedSignal = decode(message.data);
        assertHolochainSignal(deserializedSignal);

        if (SignalType.System in deserializedSignal) {
          this.emit("signal", {
            System: deserializedSignal[SignalType.System],
          } as Signal);
        } else {
          const encodedAppSignal = deserializedSignal[SignalType.App];

          // In order to return readable content to the UI, the signal payload must also be deserialized.
          const payload = decode(encodedAppSignal.signal);

          const signal: AppSignal = {
            cell_id: encodedAppSignal.cell_id,
            zome_name: encodedAppSignal.zome_name,
            payload,
          };
          this.emit("signal", { App: signal } as Signal);
        }
      } else if (message.type === "response") {
        this.handleResponse(message);
      } else {
        throw new HolochainError(
          "UnknownMessageType",
          `incoming message has unknown type - ${message.type}`
        );
      }
    };
  }

  private registerCloseListener(socket: IsoWebSocket) {
    socket.addEventListener(
      "close",
      (closeEvent) => {
        const pendingRequestIds = Object.keys(this.pendingRequests).map((id) =>
          parseInt(id)
        );
        if (pendingRequestIds.length) {
          pendingRequestIds.forEach((id) => {
            const error = new HolochainError(
              "ClientClosedWithPendingRequests",
              `client closed with pending requests - close event code: ${closeEvent.code}, request id: ${id}`
            );
            this.pendingRequests[id].reject(error);
            delete this.pendingRequests[id];
          });
        }
      },
      { once: true }
    );
  }

  private async reconnectWebsocket(url: URL, token: AppAuthenticationToken) {
    return new Promise<void>((resolve, reject) => {
      this.socket = new IsoWebSocket(url, this.options);
      // This error event never occurs in tests. Could be removed?
      this.socket.addEventListener(
        "error",
        (errorEvent) => {
          this.authenticationToken = undefined;
          reject(
            new HolochainError(
              "ConnectionError",
              `could not connect to Holochain Conductor API at ${url} - ${errorEvent.message}`
            )
          );
        },
        { once: true }
      );

      const invalidTokenCloseListener = (
        closeEvent: IsoWebSocket.CloseEvent
      ) => {
        this.authenticationToken = undefined;
        reject(
          new HolochainError(
            "InvalidTokenError",
            `could not connect to ${this.url} due to an invalid app authentication token - close code ${closeEvent.code}`
          )
        );
      };
      this.socket.addEventListener("close", invalidTokenCloseListener, {
        once: true,
      });

      this.socket.addEventListener(
        "open",
        async (_) => {
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
        { once: true }
      );
    });
  }

  private handleResponse(msg: HolochainMessage) {
    const id = msg.id;
    if (this.pendingRequests[id]) {
      if (msg.data === null || msg.data === undefined) {
        this.pendingRequests[id].reject(
          new Error("Response canceled by responder")
        );
      } else {
        this.pendingRequests[id].resolve(decode(msg.data));
      }
      delete this.pendingRequests[id];
    } else {
      console.error(
        `got response with no matching request. id = ${id} msg = ${msg}`
      );
    }
  }
}

function assertHolochainMessage(
  message: unknown
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
      4
    )}`
  );
}

function assertHolochainSignal(signal: unknown): asserts signal is RawSignal {
  if (
    typeof signal === "object" &&
    signal !== null &&
    Object.values(SignalType).some((type) => type in signal)
  ) {
    return;
  }
  throw new HolochainError(
    "UnknownSignalFormat",
    `incoming signal has unknown signal format ${JSON.stringify(
      signal,
      null,
      4
    )}`
  );
}

export { IsoWebSocket };
