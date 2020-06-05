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

import * as Api from '../api/common'
import { AppApi, CallZomeRequest, CallZomeResponse, AppInfoRequest, AppInfoResponse } from '../api/app'
import { WsClient } from './client'
import { catchError } from './common'

export class AppWebsocket implements AppApi {
  client: WsClient

  constructor(client: WsClient) {
    this.client = client
  }

  static connect(url: string, signalCb?: Function): Promise<AppWebsocket> {
    return WsClient.connect(url, signalCb).then(client => new AppWebsocket(client))
  }

  _request = <Req, Res>(req: Req): Promise<Res> => this.client.request(req).then(catchError)
  _requester = <Req, Res>(tag: string) => Api.tagged<Req, Res>(tag, this._request)

  // the specific request/response types come from the Interface
  // which this class implements

  appInfo: Api.Requester<AppInfoRequest, AppInfoResponse>
    = this._requester('AppInfo')
  callZome: Api.Requester<CallZomeRequest, CallZomeResponse>
    = this._requester('ZomeCallInvocation')
}
