import Websocket from 'isomorphic-ws'
import * as msgpack from '@msgpack/msgpack'
import { nanoid } from 'nanoid'

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
    const encoded = msgpack.encode({
      type: 'Signal',
      data: msgpack.encode(data),
    })
    this.socket.send(encoded)
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
    this.socket.send(encodedMsg)
    return promise as Promise<Res>
  }

  close(): Promise<void> {
    this.socket.close()
    return this.awaitClose()
  }

  awaitClose(): Promise<void> {
    return new Promise((resolve) => this.socket.on('close', resolve))
  }

  static connect(url: string, signalCb?: Function): Promise<WsClient> {
    return new Promise((resolve, reject) => {
      const socket = new Websocket(url)
      // make sure that there are no uncaught connection
      // errors because that causes nodejs thread to crash
      // with uncaught exception
      socket.onerror = (e) => {
        if (e.error.code === 'ECONNRESET' || e.error.code === 'ECONNREFUSED') {
          reject(
            new Error(
              `could not connect to holochain conductor, please check that a conductor service is running and available at ${url}`
            )
          )
        } else {
          reject(e)
        }
      }
      socket.onopen = () => {
        const hw = new WsClient(socket)
        socket.onmessage = async (encodedMsg: any) => {
          let data = encodedMsg.data

          // If data is not a buffer, it will be a blob
          if (!Buffer.isBuffer(data)) {
            data = await data.arrayBuffer()
          }

          const msg: any = msgpack.decode(data)
          if (signalCb && msg.type === 'Signal') {
            signalCb(msgpack.decode(msg.data))
          } else if (msg.type === 'Response') {
            const id = msg.id
            if (hw.pendingRequests[id]) {
              // resolve response
              hw.pendingRequests[id].fulfill(msgpack.decode(msg.data))
            } else {
              console.error(`Got response with no matching request. id=${id}`)
            }
          } else {
            console.error(
              `Got unrecognized Websocket message type: ${msg.type}`
            )
          }
        }

        resolve(hw)
      }
    })
  }
}
