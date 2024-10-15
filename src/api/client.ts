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
    this.socket = socket;
    this.url = url;
    this.options = options || {};
    this.pendingRequests = {};
    this.index = 0;

    this.setupSocket();
  }

  private setupSocket() {
    this.socket.onmessage = async (serializedMessage) => {
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

    this.socket.onclose = (event) => {
      const pendingRequestIds = Object.keys(this.pendingRequests).map((id) =>
        parseInt(id)
      );
      if (pendingRequestIds.length) {
        pendingRequestIds.forEach((id) => {
          const error = new HolochainError(
            "ClientClosedWithPendingRequests",
            `client closed with pending requests - close event code: ${event.code}, request id: ${id}`
          );
          this.pendingRequests[id].reject(error);
          delete this.pendingRequests[id];
        });
      }
    };
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
      socket.onerror = (errorEvent) => {
        reject(
          new HolochainError(
            "ConnectionError",
            `could not connect to Holochain Conductor API at ${url} - ${errorEvent.error}`
          )
        );
      };
      socket.onopen = () => {
        const client = new WsClient(socket, url, options);
        resolve(client);
      };
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
    return this.exchange(request, (request, resolve) => {
      const encodedMsg = encode({
        type: "authenticate",
        data: encode(request),
      });
      this.socket.send(encodedMsg);
      // Message just needs to be sent first, no need to wait for a response or even require a flush
      resolve(null);
    });
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

  private exchange<Response>(
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
      const response = new Promise<unknown>((resolve, reject) => {
        // typescript forgets in this promise scope that `this.url` is not undefined
        const socket = new IsoWebSocket(this.url as URL, this.options);
        this.socket = socket;
        socket.onerror = (errorEvent) => {
          reject(
            new HolochainError(
              "ConnectionError",
              `could not connect to Holochain Conductor API at ${this.url} - ${errorEvent.error}`
            )
          );
        };
        socket.onopen = () => {
          // Send authentication token
          const encodedMsg = encode({
            type: "authenticate",
            data: encode({
              token: this.authenticationToken as AppAuthenticationToken,
            }),
          });
          this.socket.send(encodedMsg);
          sendHandler(request, resolve, reject);
        };
        this.setupSocket();
      });
      return response as Promise<Response>;
    } else {
      return Promise.reject(new Error("Socket is not open"));
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

  /**
   * Close the websocket connection.
   */
  close(code = 1000) {
    const closedPromise = new Promise<CloseEvent>(
      (resolve) =>
        // for an unknown reason "addEventListener" is seen as a non-callable
        // property and gives a ts2349 error
        // type assertion as workaround
        (this.socket as unknown as WebSocket).addEventListener(
          "close",
          (event) => resolve(event)
        )
      // }
    );

    this.socket.close(code);
    return closedPromise;
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
