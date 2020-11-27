import Websocket from 'isomorphic-ws'
import * as msgpack from '@msgpack/msgpack'
import { nanoid } from 'nanoid'
import { AppSignal, AppSignalCb, SignalResponseGeneric } from '../api/app'

/**
 * A Websocket client which can make requests and receive responses,
 * as well as send and receive signals
 *
 * Uses Holochain's websocket WireMessage for communication.
 */
export class WsClient {
  socket: Websocket
  pendingRequests: Record<string, { fulfill: Function }>

  constructor(socket: any) {
    this.socket = socket
    this.pendingRequests = {}
    // TODO: allow adding signal handlers later
  }

  emitSignal(data: any) {
    const encodedMsg = msgpack.encode({
      type: 'Signal',
      data: msgpack.encode(data),
    })
    this.socket.send(encodedMsg)
  }

  request<Req, Res>(data: Req): Promise<Res> {
    const id = nanoid()
    const encodedMsg = msgpack.encode({
      id,
      type: 'Request',
      data: msgpack.encode(data),
    })
    const promise = new Promise((fulfill) => {
      this.pendingRequests[id] = { fulfill }
    })
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(encodedMsg)
    } else {
      return Promise.reject(new Error(`Socket is not open`))
    }
    return promise as Promise<Res>
  }

  close(): Promise<void> {
    this.socket.close()
    return this.awaitClose()
  }

  awaitClose(): Promise<void> {
    return new Promise((resolve) => this.socket.on('close', resolve))
  }

  static connect(url: string, signalCb?: AppSignalCb): Promise<WsClient> {
    return new Promise((resolve, reject) => {
      const socket = new Websocket(url)
      // make sure that there are no uncaught connection
      // errors because that causes nodejs thread to crash
      // with uncaught exception
      socket.onerror = (e) => {
        reject(new Error(
          `could not connect to holochain conductor, please check that a conductor service is running and available at ${url}`
        ))
      }
      socket.onopen = () => {
        const hw = new WsClient(socket)
        socket.onmessage = async (encodedMsg: any) => {
          let data = encodedMsg.data

          // If data is not a buffer (nodejs), it will be a blob (browser)
          if (typeof Buffer === "undefined" || !Buffer.isBuffer(data)) {
            data = await data.arrayBuffer()
          }

          const msg: any = msgpack.decode(data)
          if (signalCb && msg.type === 'Signal') {
            const decodedMessage: SignalResponseGeneric<any> = msgpack.decode(msg.data);

            // Note: holochain currently returns signals as an array of two values: cellId and the seralized signal payload
            // and this array is nested within the App key within the returned message.
            const decodedCellId = decodedMessage.App[0];
            // Note:In order to return readible content to the UI, the signal payload must also be decoded.
            const decodedPayload = signalTransform(decodedMessage.App[1]);

            // Return a uniform format to UI (ie: { type, data } - the same format as with callZome and appInfo...)
            const signal: AppSignal = { type: msg.type , data: { cellId: decodedCellId, payload: decodedPayload }};
            signalCb(signal);

          } else if (msg.type === 'Response') {
            const id = msg.id;
            if (hw.pendingRequests[id]) {
              // resolve response
              hw.pendingRequests[id].fulfill(msgpack.decode(msg.data));
            } else {
              console.error(`Got response with no matching request. id=${id}`);
            }
          } else {
            console.error(`Got unrecognized Websocket message type: ${msg.type}`);
          }
        }

        resolve(hw)
      }
    })
  }
}

const signalTransform = (res: SignalResponseGeneric<Buffer>): SignalResponseGeneric<any> => {
    return msgpack.decode(res)
}
