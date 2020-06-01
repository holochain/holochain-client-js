/**
 * Defines AdminWebsocket, an easy-to-use websocket implementation of the
 * Conductor Admin API
 *
 *    const client = AdminWebsocket.connect(
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
  installDna = tagged<Api.InstallDnaRequest, Api.InstallDnaResponse>('InstallDna', this._request)
  listDnas = tagged<Api.ListDnasRequest, Api.ListDnasResponse>('ListDnas', this._request)
}
