import Websocket from "isomorphic-ws";
import { encode, decode } from "@msgpack/msgpack";
import { nanoid } from "nanoid";
import { AppSignal, AppSignalCb, SignalResponseGeneric } from "../api/app";

/**
 * A Websocket client which can make requests and receive responses,
 * as well as send and receive signals
 *
 * Uses Holochain's websocket WireMessage for communication.
 */
export class WsClient {
  socket: Websocket;
  pendingRequests: Record<number, { fulfill: Function; reject: Function }>;
  index: number;
  alreadyWarnedNoSignalCb: boolean;

  constructor(socket: any, signalCb?: AppSignalCb) {
    this.socket = socket;
    this.pendingRequests = {};
    this.index = 0;
    // TODO: allow adding signal handlers later
    this.alreadyWarnedNoSignalCb = false;
    socket.onmessage = async (encodedMsg: any) => {
      let data = encodedMsg.data;

      // If data is not a buffer (nodejs), it will be a blob (browser)
      if (typeof Buffer === "undefined" || !Buffer.isBuffer(data)) {
        data = await data.arrayBuffer();
      }

      const msg: any = decode(data);
      if (msg.type === "Signal") {
        if (signalCb) {
          const decodedMessage: SignalResponseGeneric<any> = decode(
            msg.data
          );

          // Note: holochain currently returns signals as an array of two values: cellId and the serialized signal payload
          // and this array is nested within the App key within the returned message.
          const decodedCellId = decodedMessage.App[0];
          // Note:In order to return readible content to the UI, the signal payload must also be decoded.
          const decodedPayload = signalTransform(decodedMessage.App[1]);

          // Return a uniform format to UI (ie: { type, data } - the same format as with callZome and appInfo...)
          const signal: AppSignal = {
            type: msg.type,
            data: { cellId: decodedCellId, payload: decodedPayload },
          };
          signalCb(signal);
        } else {
          if (!this.alreadyWarnedNoSignalCb)
            console.log(
              `Received signal but no signal callback was set in constructor`
            );
          this.alreadyWarnedNoSignalCb = true;
        }
      } else if (msg.type === "Response") {
        this.handleResponse(msg);
      } else {
        console.error(`Got unrecognized Websocket message type: ${msg.type}`);
      }
    };
  }

  emitSignal(data: any) {
    const encodedMsg = encode({
      type: "Signal",
      data: encode(data),
    });
    this.socket.send(encodedMsg);
  }

  request<Req, Res>(data: Req): Promise<Res> {
    let id = this.index;
    this.index += 1;
    const encodedMsg = encode({
      id,
      type: "Request",
      data: encode(data),
    });
    const promise = new Promise((fulfill, reject) => {
      this.pendingRequests[id] = { fulfill, reject };
    });
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(encodedMsg);
    } else {
      return Promise.reject(new Error(`Socket is not open`));
    }
    return promise as Promise<Res>;
  }

  handleResponse(msg: any) {
    const id = msg.id;
    if (this.pendingRequests[id]) {
      // resolve response
      if (msg.data === null || msg.data === undefined) {
        this.pendingRequests[id].reject(
          new Error(`Response canceled by responder`)
        );
      } else {
        this.pendingRequests[id].fulfill(decode(msg.data));
      }
    } else {
      console.error(`Got response with no matching request. id=${id}`);
    }
  }

  close(): Promise<void> {
    this.socket.close();
    return this.awaitClose();
  }

  awaitClose(): Promise<void> {
    return new Promise((resolve) => this.socket.on("close", resolve));
  }

  static connect(url: string, signalCb?: AppSignalCb): Promise<WsClient> {
    return new Promise((resolve, reject) => {
      const socket = new Websocket(url);
      // make sure that there are no uncaught connection
      // errors because that causes nodejs thread to crash
      // with uncaught exception
      socket.onerror = (e) => {
        reject(
          new Error(
            `could not connect to holochain conductor, please check that a conductor service is running and available at ${url}`
          )
        );
      };
      socket.onopen = () => {
        resolve(new WsClient(socket, signalCb));
      };
    });
  }
}

const signalTransform = (
  res: SignalResponseGeneric<Buffer>
): SignalResponseGeneric<any> => {
  return decode(res);
};
