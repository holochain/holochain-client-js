
const test = require('tape')
import * as msgpack from 'msgpack-lite'

import { AdminWebsocket } from '../../src/websocket/admin'
import { AppWebsocket } from '../../src/websocket/app'
import { withConductor } from './util'

const ADMIN_PORT = 33001
const APP_ID = 'app'

test('basic app interface methods', withConductor(ADMIN_PORT, async t => {

  const admin = await AdminWebsocket.connect(`http://localhost:${ADMIN_PORT}`)

  const agent = await admin.generateAgentPubKey()
  const app = await admin.installApp({
    app_id: APP_ID,
    agent_key: agent,
    dnas: [{
      path: 'test/e2e/fixture/test.dna.gz',
      nick: 'mydna',
    }],
  })
  t.equal(app.cell_data.length, 1)
  const cellId = app.cell_data[0][0]

  await admin.activateApp({ app_id: APP_ID })

  const { port: appPort } = await admin.attachAppInterface({ port: 0 })

  const client = await AppWebsocket.connect(`http://localhost:${appPort}`)

  const info = await client.appInfo({ app_id: APP_ID })
  t.deepEqual(info.cell_data[0][0], cellId)
  t.equal(info.cell_data[0][1], 'mydna')

  const serializedResponse = await client.callZome({
    cap: 'secret',
    cell_id: cellId,
    zome_name: 'foo',
    fn_name: 'foo',
    payload: [],  // TODO: should this be byte array?
    provenance: 'TODO' as any,
  })
  const response = msgpack.decode(serializedResponse)
  t.equal(response, "foo")
}))
