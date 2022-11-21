/**
 * Defines AppWebsocket, an easy-to-use websocket implementation of the
 * Conductor API for apps
 *
 *    const client = AppWebsocket.connect(
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
import { EventEmitter } from 'events'
import ldsh from 'lodash'
const { omit } = ldsh

import { InstalledAppId } from '../../types.js';
import { AppInfoResponse, AppWebsocket, CallZomeRequest, CallZomeResponse, InstalledAppInfo } from "../index.js";
import {
  AppAgentCallZomeRequest,
  AppAgentClient,
} from "./types.js";

export class AppAgentWebsocket extends EventEmitter implements AppAgentClient  {
  appWebsocket: AppWebsocket;
  installedAppId: InstalledAppId;
  // cachedAppInfo: InstalledAppInfo | undefined

  constructor(
    appWebsocket: AppWebsocket,
    installedAppId: InstalledAppId
  ) {
    super()
    this.appWebsocket = appWebsocket;
    this.installedAppId = installedAppId
  }

  // async appInfo (): Promise<AppInfoResponse> {
  //   // We cache appInfo because we call it on every zomeCall
  //   if (!this.cachedAppInfo) {
  //     this.cachedAppInfo = await this.appWebsocket.appInfo({
  //       installed_app_id: this.installedAppId
  //     })  
  //   }

  //   return this.cachedAppInfo
  // };


  async appInfo (): Promise<AppInfoResponse> {
    return this.appWebsocket.appInfo({
      installed_app_id: this.installedAppId
    })  
  }

  async callZome (request: AppAgentCallZomeRequest): Promise<CallZomeResponse> {
    if (request.role_id) {
      const appInfo = await this.appInfo()
      const cell_id = appInfo.cell_data.find(c => c.role_id === request.role_id)?.cell_id
      
      if (!cell_id) {
        throw new Error(`TODO: No cell found with role_id ${request.role_id}`)
      }

      const callZomeRequest = {
        ...omit(request, 'role_id'),
        cell_id
      }
      return this.appWebsocket.callZome(callZomeRequest)
    } else if (request.cell_id) {
      return this.appWebsocket.callZome(request as CallZomeRequest)
    } else {
      // TODO: can this be handled in ts?
      throw new Error('TODO: callZome requires a role_id or cell_id arg')
    }
  };
}
