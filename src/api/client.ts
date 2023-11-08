import { decode, encode } from "@msgpack/msgpack";
import Emittery from "emittery";
import IsoWebSocket from "isomorphic-ws";
import { AppSignal, Signal, SignalType } from "./app/types.js";

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
  private pendingRequests: Record<number, HolochainRequest>;
  private index: number;

  constructor(socket: IsoWebSocket, url: URL) {
    super();
    this.socket = socket;
    this.url = url;
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
          throw new Error("websocket client: unknown message format");
        }
      }

      const message = decode(deserializedData);
      assertHolochainMessage(message);

      if (message.type === "signal") {
        if (message.data === null) {
          throw new Error("received a signal without data");
        }
        const deserializedSignal = decode(message.data);
        assertHolochainSignal(deserializedSignal);

        if (SignalType.System in deserializedSignal) {
          // We have received a system signal, do nothing
          return;
        }
        const encodedAppSignal = deserializedSignal[SignalType.App];

        // In order to return readable content to the UI, the signal payload must also be deserialized.
        const payload = decode(encodedAppSignal.signal);

        const signal: AppSignal = {
          cell_id: encodedAppSignal.cell_id,
          zome_name: encodedAppSignal.zome_name,
          payload,
        };
        this.emit("signal", signal);
      } else if (message.type === "response") {
        this.handleResponse(message);
      } else {
        console.error(
          `Got unrecognized Websocket message type: ${message.type}`
        );
      }
    };

    this.socket.onclose = (event) => {
      const pendingRequestIds = Object.keys(this.pendingRequests).map((id) =>
        parseInt(id)
      );
      if (pendingRequestIds.length) {
        pendingRequestIds.forEach((id) => {
          const error = new Error(
            `Websocket closed with pending requests. Close event code: ${event.code}, request id: ${id}`
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
   * @returns An new instance of the WsClient.
   */
  static connect(url: URL) {
    return new Promise<WsClient>((resolve, reject) => {
      const socket = new IsoWebSocket(url);
      socket.onerror = () => {
        reject(
          new Error(
            `could not connect to holochain conductor, please check that a conductor service is running and available at ${url}`
          )
        );
      };
      socket.onopen = () => {
        const client = new WsClient(socket, url);
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
   * Send requests to the connected websocket.
   *
   * @param request - The request to send over the websocket.
   * @returns
   */
  async request<Response>(request: unknown): Promise<Response> {
    if (this.socket.readyState === this.socket.OPEN) {
      const promise = new Promise((resolve, reject) => {
        this.sendMessage(request, resolve, reject);
      });
      return promise as Promise<Response>;
    } else if (this.url) {
      const response = new Promise<unknown>((resolve, reject) => {
        // typescript forgets in this promise scope that this.url is not undefined
        const socket = new IsoWebSocket(this.url as URL);
        this.socket = socket;
        socket.onerror = () => {
          reject(
            new Error(
              `could not connect to Holochain conductor, please check that a conductor service is running and available at ${this.url}`
            )
          );
        };
        socket.onopen = () => {
          this.sendMessage(request, resolve, reject);
        };

        this.setupSocket();
      });
      return response as Response;
    } else {
      return Promise.reject(new Error("Socket is not open"));
    }
  }

  private sendMessage(
    request: unknown,
    resolve: RequestResolver,
    reject: RequestRejecter
  ) {
    function toHexString(byteArray: number[]) {
      return Array.from(byteArray, function(byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
      }).join(', ')
    }

    console.log("sending message", request, toHexString(encode(request) as unknown as number[]))

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
    function toHexString(byteArray: number[]) {
      return Array.from(byteArray, function(byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
      }).join(', ')
    }

    const id = msg.id;
    if (this.pendingRequests[id]) {
      if (msg.data === null || msg.data === undefined) {
        this.pendingRequests[id].reject(
          new Error("Response canceled by responder")
        );
      } else {
        console.log('got a response back', msg.data, toHexString(msg.data as unknown as number[]));
        this.pendingRequests[id].resolve(decode(msg.data));
      }
      delete this.pendingRequests[id];
    } else {
      console.error(`Got response with no matching request. id=${id}`);
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
  throw new Error(`unknown message format ${JSON.stringify(message, null, 4)}`);
}

function assertHolochainSignal(signal: unknown): asserts signal is Signal {
  if (
    typeof signal === "object" &&
    signal !== null &&
    Object.values(SignalType).some((type) => type in signal)
  ) {
    return;
  }
  throw new Error(`unknown signal format ${JSON.stringify(signal, null, 4)}`);
}

export { IsoWebSocket };
