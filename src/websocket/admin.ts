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
import { catchError, promiseTimeout, DEFAULT_TIMEOUT } from './common'
import { Transformer, requesterTransformer, Requester } from '../api/common'
import {ListAppInterfacesRequest} from "../api/admin";

export class AdminWebsocket implements Api.AdminApi {
  client: WsClient
  defaultTimeout: number

  constructor(client: WsClient, defaultTimeout?: number) {
    this.client = client
    this.defaultTimeout = defaultTimeout === undefined ? DEFAULT_TIMEOUT : defaultTimeout
  }

  static async connect(url: string, defaultTimeout?: number): Promise<AdminWebsocket> {
    const wsClient = await WsClient.connect(url)
    return new AdminWebsocket(wsClient, defaultTimeout)
  }

  _requester = <ReqO, ReqI, ResI, ResO>(tag: string, transformer?: Transformer<ReqO, ReqI, ResI, ResO>) =>
    requesterTransformer(
      (req, timeout) => promiseTimeout(this.client.request(req), tag, timeout || this.defaultTimeout).then(catchError),
      tag,
      transformer
    )

  // the specific request/response types come from the Interface
  // which this class implements
  attachAppInterface: Requester<Api.AttachAppInterfaceRequest, Api.AttachAppInterfaceResponse>
    = this._requester('attach_app_interface')
  // Deprecated
  activateApp: Requester<Api.ActivateAppRequest, Api.ActivateAppResponse>
    = this._requester('activate_app')
  // Deprecated
  deactivateApp: Requester<Api.DeactivateAppRequest, Api.DeactivateAppResponse>
    = this._requester('deactivate_app')
  enableApp: Requester<Api.EnableAppRequest, Api.EnableAppResponse>
    = this._requester('enable_app')
  disableApp: Requester<Api.DisableAppRequest, Api.DisableAppResponse>
    = this._requester('disable_app')
  startApp: Requester<Api.StartAppRequest, Api.StartAppResponse>
    = this._requester('start_app')
  dumpState: Requester<Api.DumpStateRequest, Api.DumpStateResponse>
    = this._requester('dump_state', dumpStateTransform)
  generateAgentPubKey: Requester<Api.GenerateAgentPubKeyRequest, Api.GenerateAgentPubKeyResponse>
    = this._requester('generate_agent_pub_key')
  registerDna: Requester<Api.RegisterDnaRequest, Api.RegisterDnaResponse>
    = this._requester('register_dna')
  installApp: Requester<Api.InstallAppRequest, Api.InstallAppResponse>
    = this._requester('install_app')
  installAppBundle: Requester<Api.InstallAppBundleRequest, Api.InstallAppBundleResponse>
    = this._requester('install_app_bundle')
  createCloneCell: Requester<Api.CreateCloneCellRequest, Api.CreateCloneCellResponse>
    = this._requester('create_clone_cell')
  listDnas: Requester<Api.ListDnasRequest, Api.ListDnasResponse>
    = this._requester('list_dnas')
  listCellIds: Requester<Api.ListCellIdsRequest, Api.ListCellIdsResponse>
    = this._requester('list_cell_ids')
  // Deprecated
  listActiveApps: Requester<Api.ListActiveAppsRequest, Api.ListActiveAppsResponse>
    = this._requester('list_active_apps')
  listApps: Requester<Api.ListAppsRequest, Api.ListAppsResponse>
    = this._requester('list_apps', listAppsTransform)
  listAppInterfaces: Requester<Api.ListAppInterfacesRequest, Api.ListAppInterfacesResponse>
      = this._requester('list_app_interfaces')
  requestAgentInfo: Requester<Api.RequestAgentInfoRequest, Api.RequestAgentInfoResponse>
    = this._requester('request_agent_info')
  addAgentInfo: Requester<Api.AddAgentInfoRequest, Api.AddAgentInfoResponse>
    = this._requester('add_agent_info')
}

interface InternalListAppsRequest {
  status_filter?: 
    {Running: null} 
    | {Enabled: null} 
    | {Paused: null}
    | {Disabled: null}
    | {Stopped: null}
}

const listAppsTransform: Transformer<Api.ListAppsRequest, InternalListAppsRequest, Api.ListAppsResponse, Api.ListAppsResponse> = {
  input: (req) => {
    const args: InternalListAppsRequest = {};

    if (req.status_filter) {
      args.status_filter = getAppStatusInApiForm(req.status_filter)
    }

    return args
  },
  output: (res) => res
}

const dumpStateTransform: Transformer<Api.DumpStateRequest, Api.DumpStateRequest, string, Api.DumpStateResponse> = {
  input: (req) => req,
  output: (res: string): Api.DumpStateResponse => {
    return JSON.parse(res)
  }
}

function getAppStatusInApiForm(status_filter: Api.AppStatusFilter) {
  switch (status_filter) {
    case Api.AppStatusFilter.Running:
    return {
      Running: null
    }
    case Api.AppStatusFilter.Enabled:
    return {
      Enabled: null
    }
    case Api.AppStatusFilter.Paused:
    return {
      Paused: null
    }
    case Api.AppStatusFilter.Disabled:
    return {
      Disabled: null
    }
    case Api.AppStatusFilter.Stopped:
    return {
      Stopped: null
    }
  }
}