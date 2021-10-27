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
import { encode, decode } from '@msgpack/msgpack'

import { AppApi, AppInfoRequest, AppInfoResponse, CallZomeRequestGeneric, CallZomeResponseGeneric, AppSignalCb } from '../api/app'
import { WsClient } from './client'
import { catchError, promiseTimeout, DEFAULT_TIMEOUT } from './common'
import { Transformer, requesterTransformer, Requester } from '../api/common'
import { getLauncherEnvironment } from '../environments/launcher'
import { InstalledAppId } from '../api/types'

export class AppWebsocket implements AppApi {
  client: WsClient
  defaultTimeout: number

  constructor(client: WsClient, defaultTimeout?: number, protected overrideInstalledAppId?: InstalledAppId) {
    this.client = client
    this.defaultTimeout = defaultTimeout === undefined ? DEFAULT_TIMEOUT : defaultTimeout
  }

  static async connect(url: string, defaultTimeout?: number, signalCb?: AppSignalCb): Promise<AppWebsocket> {
    // Check if we are in the launcher's environment, and if so, redirect the url to connect to
    const env = await getLauncherEnvironment()

    if (env) {
      url = `ws://localhost:${env.APP_INTERFACE_PORT}`
    }

    const wsClient = await WsClient.connect(url, signalCb)
    return new AppWebsocket(wsClient, defaultTimeout, env ? env.INSTALLED_APP_ID: undefined)
  }

  _requester = <ReqO, ReqI, ResI, ResO>(tag: string, transformer?: Transformer<ReqO, ReqI, ResI, ResO>) =>
    requesterTransformer(
      (req, timeout) => promiseTimeout(this.client.request(req), tag, timeout || this.defaultTimeout).then(catchError),
      tag,
      transformer
    )

  appInfo: Requester<AppInfoRequest, AppInfoResponse>
    = this._requester('app_info', appInfoTransform(this.overrideInstalledAppId))
  callZome: Requester<CallZomeRequestGeneric<any>, CallZomeResponseGeneric<any>>
    = this._requester('zome_call_invocation', callZomeTransform)
}

const callZomeTransform: Transformer<CallZomeRequestGeneric<any>, CallZomeRequestGeneric<Uint8Array>, CallZomeResponseGeneric<Uint8Array>, CallZomeResponseGeneric<any>> = {
  input: (req: CallZomeRequestGeneric<any>): CallZomeRequestGeneric<Uint8Array> => {
    return {
      ...req,
      payload: encode(req.payload),
    }
  },
  output: (res: CallZomeResponseGeneric<Uint8Array>): CallZomeResponseGeneric<any> => {
    return decode(res)
  },
}

const appInfoTransform = (overrideInstalledAppId?: InstalledAppId): Transformer<AppInfoRequest, AppInfoRequest, AppInfoResponse, AppInfoResponse> => ({
  input: (req:  AppInfoRequest): AppInfoRequest => {
    if (overrideInstalledAppId) {
      return {
        installed_app_id: overrideInstalledAppId,
      }
    } 

    return req
  },
  output: (res: AppInfoResponse): AppInfoResponse => {
    return res
  },
})
