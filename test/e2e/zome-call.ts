
const test = require('tape')

import { AdminWebsocket } from '../../src/websocket/admin'
import { AppWebsocket } from '../../src/websocket/app'

import { withConductor } from './util'

const ADMIN_PORT = 33001
const APP_ID = 'app'

test('basic app interface methods', withConductor(ADMIN_PORT, async t => {

  const admin = await AdminWebsocket.connect(`http://localhost:${ADMIN_PORT}`)

  const agent = await admin.generateAgentPubKey()
  const cellIds = await admin.installApp({
    app_id: APP_ID,
    agent_key: agent,
    dnas: [['test/e2e/fixture/test.dna.gz', null]],
    proofs: {}
  })
  t.equal(cellIds.length, 1)
  const cellId = cellIds[0]

  await admin.activateApp({ app_id: APP_ID })

  const { port: appPort } = await admin.attachAppInterface({ port: 0 })

  const client = await AppWebsocket.connect(`http://localhost:${appPort}`)

  const response = await client.callZome({
    type: 'ZomeCallInvocationRequest',
    data: {
      cap: 'secret',
      cell_id: cellId,
      zome_name: 'foo',
      fn_name: 'foo',
      payload: [],  // TODO: should this be byte array?
      provenance: '',
    }
  })
  t.equal(1, 1)

  console.log(response)
}))

// async function run() {

// }

// run().catch(e => { console.error(e); process.exit(1) })
