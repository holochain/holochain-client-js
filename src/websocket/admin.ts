/**
 * Defines AdminWebsocket, an easy-to-use websocket implementation of the
 * Conductor Admin API
 *
 *    const client = AdminWebsocket.connect(
 *      'ws://localhost:9000',
 *      signal => console.log('got a signal:', signal)
 *    )
 *
 *    client.generateAgentPubKey()
 *      .then(agentPubKey => {
 *        console.log('Agent successfully generated:', agentPubKey)
 *      })
 *      .catch(err => {
 *        console.error('problem generating agent:', err)
 *      })
 */

import * as Api from '../api/admin'
import { WsClient } from './client'
import { catchError } from './common'
import { tagged } from '../api/common'

export class AdminWebsocket implements Api.AdminApi {
  client: WsClient

  constructor(client: WsClient) {
    this.client = client
  }

  static connect(url: string, signalCb?: Function | undefined): Promise<AdminWebsocket> {
    return WsClient.connect(url, signalCb).then(client => new AdminWebsocket(client))
  }

  _request = <Req, Res>(req: Req) => this.client.request(req).then(catchError)

  // the specific request/response types come from the Interface
  // which this class implements
  activateApp = tagged<Api.ActivateAppRequest, Api.ActivateAppResponse>('ActivateApp', this._request)
  deactivateApp = tagged<Api.DeactivateAppRequest, Api.DeactivateAppResponse>('DeactivateApp', this._request)
  installApp = tagged<Api.InstallAppRequest, Api.InstallAppResponse>('InstallApp', this._request)
  listDnas = tagged<Api.ListDnasRequest, Api.ListDnasResponse>('ListDnas', this._request)
  dumpState = tagged<Api.DumpStateRequest, Api.DumpStateResponse>('DumpState', this._request)
  generateAgentPubKey = tagged<Api.GenerateAgentPubKeyRequest, Api.GenerateAgentPubKeyResponse>('GenerateAgentPubKey', this._request)
  attachAppInterface = tagged<Api.AttachAppInterfaceRequest, Api.AttachAppInterfaceResponse>('AttachAppInterface', this._request)
}
