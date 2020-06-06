/**
 * Defines AppWebsocket, an easy-to-use websocket implementation of the
 * Conductor API for apps
 *
 *    const client = AdminWebsocket.connect(
 *      'ws://localhost:9000',
 *      signal => console.log('got a signal:', signal)
 *    )
 *
 *    client.callZome({...})  // TODO: show what's in here
 *      .then(() => {
 *        console.log('DNA successfully installed')
 *      })
 *      .catch(err => {
 *        console.error('problem installing DNA:', err)
 *      })
 */
import * as msgpack from 'msgpack-lite'

import { AppApi, CallZomeRequest, CallZomeResponse, AppInfoRequest, AppInfoResponse, CallZomeRequestGeneric, CallZomeResponseGeneric } from '../api/app'
import { WsClient } from './client'
import { catchError } from './common'
import { Transformer, requesterTransformer, Requester } from '../api/common'

export class AppWebsocket implements AppApi {
  client: WsClient

  constructor(client: WsClient) {
    this.client = client
  }

  static connect(url: string, signalCb?: Function): Promise<AppWebsocket> {
    return WsClient.connect(url, signalCb).then(client => new AppWebsocket(client))
  }

  _requester = <ReqO, ReqI, ResI, ResO>(tag: string, transformer?: Transformer<ReqO, ReqI, ResI, ResO>) =>
    requesterTransformer(
      req => this.client.request(req).then(catchError),
      tag,
      transformer
    )

  appInfo: Requester<AppInfoRequest, AppInfoResponse>
    = this._requester('AppInfo')
  callZome: Requester<CallZomeRequestGeneric<any>, CallZomeResponseGeneric<any>>
    = this._requester('ZomeCallInvocation', callZomeTransform)
}

const callZomeTransform: Transformer<CallZomeRequestGeneric<any>, CallZomeRequestGeneric<Buffer>, CallZomeResponseGeneric<Buffer>, CallZomeResponseGeneric<any>> = {
  input: (req: CallZomeRequestGeneric<any>): CallZomeRequestGeneric<Buffer> => {
    // FIXME: the Buffer produced by msgpack.encode must be converted to an Array of numbers,
    // because on the Holochain side, SerializedBytes only knows how to deserialize from an array.
    // Once SerializedBytes and other structs are ported to use serde_bytes, then the following line
    // can be rewritten as:
    // req.payload = msgpack.encode(req.payload)
    req.payload = [...msgpack.encode(req.payload)]
    return req
  },
  output: (res: CallZomeResponseGeneric<Buffer>): CallZomeResponseGeneric<any> => {
    return msgpack.decode(res)
  }
}
