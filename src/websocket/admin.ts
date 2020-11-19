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

  static async connect(url: string): Promise<AdminWebsocket> {
    const wsClient = await WsClient.connect(url)
    return new AdminWebsocket(wsClient)
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
    = this._requester('activate_app')
  attachAppInterface: Requester<Api.AttachAppInterfaceRequest, Api.AttachAppInterfaceResponse>
    = this._requester('attach_app_interface')
  deactivateApp: Requester<Api.DeactivateAppRequest, Api.DeactivateAppResponse>
    = this._requester('deactivate_app')
  dumpState: Requester<Api.DumpStateRequest, Api.DumpStateResponse>
    = this._requester('dump_state', dumpStateTransform)
  generateAgentPubKey: Requester<Api.GenerateAgentPubKeyRequest, Api.GenerateAgentPubKeyResponse>
    = this._requester('generate_agent_pub_key')
  installApp: Requester<Api.InstallAppRequest, Api.InstallAppResponse>
    = this._requester('install_app')
  listDnas: Requester<Api.ListDnasRequest, Api.ListDnasResponse>
    = this._requester('list_dnas')
  listCellIds: Requester<Api.ListCellIdsRequest, Api.ListCellIdsResponse>
    = this._requester('list_cell_ids')
  listActiveApps: Requester<Api.ListActiveAppsRequest, Api.ListActiveAppsResponse>
    = this._requester('list_active_apps')
}


const dumpStateTransform: Transformer<Api.DumpStateRequest, Api.DumpStateRequest, string, Api.DumpStateResponse> = {
  input: (req) => req,
  output: (res: string): Api.DumpStateResponse => {
    return JSON.parse(res)
  }
}
