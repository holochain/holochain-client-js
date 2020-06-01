
const test = require('tape')

import { AdminWebsocket } from '../../src/websocket/admin'
import { AppWebsocket } from '../../src/websocket/app'

import { withConductor } from './util'

const PORT = 33001

test('basic app interface methods', withConductor(PORT, async t => {

  const client = await AppWebsocket.connect(`http://localhost:${PORT}`)

  const response = await client.callZome({
    type: 'ZomeCallInvocationRequest',
    data: {
      request: {
        cap: 'secret',
        cell_id: ['', ''],
        zome_name: 'foo',
        fn_name: 'bar',
        payload: [],  // TODO: should this be byte array?
        provenance: '',
      }
    }
  })
  t.equal(1, 1)

  console.log(response)
}))

// async function run() {

// }

// run().catch(e => { console.error(e); process.exit(1) })
