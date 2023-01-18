import { decode, encode } from "@msgpack/msgpack";
import Emittery from "emittery";
import Websocket from "isomorphic-ws";
import { AppSignal, Signal, SignalType } from "./app/types.js";

interface HolochainMessage {
  id: number;
  type: "response" | "signal";
  data: ArrayLike<number> | null;
}

/**
 * A Websocket client which can make requests and receive responses,
 * as well as send and receive signals
 *
 * Uses Holochain's websocket WireMessage for communication.
 *
 * @public
 */
export class WsClient extends Emittery {
  socket: Websocket;
  pendingRequests: Record<
    number,
    {
      resolve: (msg: unknown) => ReturnType<typeof decode>;
      reject: (error: Error) => void;
    }
  >;
  index: number;

  constructor(socket: Websocket) {
    super();
    this.socket = socket;
    this.pendingRequests = {};
    this.index = 0;

    socket.onmessage = async (serializedMessage) => {
      // If data is not a buffer (nodejs), it will be a blob (browser)
      let deserializedData;
      if (serializedMessage.data instanceof Blob) {
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
        const derializedSignal = decode(message.data);
        assertHolochainSignal(derializedSignal);

        if (!(SignalType.App in derializedSignal)) {
          // We have received a system signal, do nothing
          return;
        }

        // Holochain currently returns signals as an array of two values: cellId and the serialized signal payload
        // and this array is nested within the App key within the returned message.
        const cell_id = derializedSignal.App[0];
        // In order to return readible content to the UI, the signal payload must also be deserialized.
        const payload = decode(derializedSignal.App[1]);

        // Return a uniform format to UI (ie: { type, data } - the same format as with callZome and appInfo...)
        const signal: AppSignal = { cell_id, payload };
        this.emit("signal", signal);
      } else if (message.type === "response") {
        this.handleResponse(message);
      } else {
        console.error(
          `Got unrecognized Websocket message type: ${message.type}`
        );
      }
    };
  }

  static connect(url: string) {
    return new Promise<WsClient>((resolve, reject) => {
      const socket = new Websocket(url);
      // make sure that there are no uncaught connection
      // errors because that causes nodejs thread to crash
      // with uncaught exception
      socket.onerror = () => {
        reject(
          new Error(
            `could not connect to holochain conductor, please check that a conductor service is running and available at ${url}`
          )
        );
      };
      socket.onopen = () => {
        const client = new WsClient(socket);
        resolve(client);
      };
    });
  }

  emitSignal(data: unknown) {
    const encodedMsg = encode({
      type: "signal",
      data: encode(data),
    });
    this.socket.send(encodedMsg);
  }

  request<Req, Res>(data: Req): Promise<Res> {
    const id = this.index;
    this.index += 1;
    const encodedMsg = encode({
      id,
      type: "request",
      data: encode(data),
    });
    const promise = new Promise((resolve, reject) => {
      this.pendingRequests[id] = { resolve, reject };
    });
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(encodedMsg);
    } else {
      return Promise.reject(new Error("Socket is not open"));
    }
    return promise as Promise<Res>;
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
      console.error(`Got response with no matching request. id=${id}`);
    }
  }

  close() {
    const closedPromise = new Promise<void>((resolve) =>
      this.socket.on("close", resolve)
    );
    this.socket.close();
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
