/**
 * Defines HcWebsocketClient, an easy-to-use websocket implementation of the
 * Conductor Admin API
 *
 *    const client = HcWebsocketClient.connect(
 *      'ws://localhost:9000',
 *      signal => console.log('got a signal:', signal)
 *    )
 *
 *    client.installDna({path: 'path/to/dna.hcdna'})
 *      .then(() => {
 *        console.log('DNA successfully installed')
 *      })
 *      .catch(err => {
 *        console.error('problem installing DNA:', err)
 *      })
 */

import Websocket from 'isomorphic-ws'
import * as msgpack from 'msgpack-lite'
import { Url } from 'url'
import { nanoid } from 'nanoid'
import * as Api from '../api/admin'

export class HcWebsocketClient implements Api.AdminApi {
  client: WsClient

  constructor(client: WsClient) {
    this.client = client
  }

  static connect(url: Url, signalCb: Function): Promise<HcWebsocketClient> {
    return WsClient.connect(url, signalCb).then(client => new HcWebsocketClient(client))
  }

  _request = <Req, Res>(req: Req) => {
    const [buf, decode] = Api.request(req)
    const promise = this.client.request(buf).then(decode)
      .then((res: any) => res.type == 'Error' ? Promise.reject(res) : res)
    return promise as Promise<Res>
  }

  // the specific request/response types come from the Interface
  // which this class implements
  installDna = this._request
  addCell = this._request
}

class WsClient {
  socket: any
  pendingRequests: Record<string, { fulfill: Function }>

  constructor(socket: any) {
    this.socket = socket
    this.pendingRequests = {}
  }

  signal(data: any) {
    const encoded = msgpack.encode({
      type: 'Signal',
      data: msgpack.encode(data),
    })
    this.socket.send(encoded)
  }

  // Make an unencoded request and
  request(data: any): Promise<any> {
    const id = nanoid()
    const encodedMsg = {
      id,
      type: 'Request',
      data: msgpack.encode(data),
    }
    const promise = new Promise((fulfill) => {
      this.pendingRequests[id] = { fulfill }
    })
    this.socket.send(encodedMsg)
    return promise
  }

  static connect(url: Url, signalCb: Function): Promise<WsClient> {
    return new Promise((resolve, reject) => {
      const socket = new Websocket(url)
      socket.onopen = () => {
        const hw = new WsClient(socket)
        socket.onmessage = (encodedMsg: any) => {
          const msg = msgpack.decode(encodedMsg.data)
          if (msg.type === 'Signal') {
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
            console.error(`Got unrecognized Websocket message type: ${msg.type}`)
          }
        }
        resolve(hw)
      }
    })
  }
}
