/**
 * Defines AdminWebsocket, an easy-to-use websocket implementation of the
 * Conductor Admin API
 *
 *    const client = AdminWebsocket.connect(
 *      'ws://localhost:9000'
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
import { Transformer, requesterTransformer, Requester } from '../api/common'

export class AdminWebsocket implements Api.AdminApi {
  client: WsClient

  constructor(client: WsClient) {
    this.client = client
  }

  // NB: Admin websockets currently never receive Signals, but in case they ever
  // do in the future, this signalCb param is provided
  static connect(url: string, signalCb?: Function | undefined): Promise<AdminWebsocket> {
    return WsClient.connect(url, signalCb).then(client => new AdminWebsocket(client))
  }

  _requester = <ReqO, ReqI, ResI, ResO>(tag: string, transformer?: Transformer<ReqO, ReqI, ResI, ResO>) =>
    requesterTransformer(
      req => this.client.request(req).then(catchError),
      tag,
      transformer
    )

  // the specific request/response types come from the Interface
  // which this class implements
  activateApp: Requester<Api.ActivateAppRequest, Api.ActivateAppResponse>
    = this._requester('ActivateApp')
  attachAppInterface: Requester<Api.AttachAppInterfaceRequest, Api.AttachAppInterfaceResponse>
    = this._requester('AttachAppInterface')
  deactivateApp: Requester<Api.DeactivateAppRequest, Api.DeactivateAppResponse>
    = this._requester('DeactivateApp')
  dumpState: Requester<Api.DumpStateRequest, Api.DumpStateResponse>
    = this._requester('DumpState', dumpStateTransform)
  generateAgentPubKey: Requester<Api.GenerateAgentPubKeyRequest, Api.GenerateAgentPubKeyResponse>
    = this._requester('GenerateAgentPubKey')
  installApp: Requester<Api.InstallAppRequest, Api.InstallAppResponse>
    = this._requester('InstallApp')
  listDnas: Requester<Api.ListDnasRequest, Api.ListDnasResponse>
    = this._requester('ListDnas')
}


const dumpStateTransform: Transformer<Api.DumpStateRequest, Api.DumpStateRequest, string, Api.DumpStateResponse> = {
  input: (req) => req,
  output: (res: string): Api.DumpStateResponse => {
    return JSON.parse(res)
  }
}
