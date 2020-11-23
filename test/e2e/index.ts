
const test = require('tape')

import { AdminWebsocket } from '../../src/websocket/admin'
import { AppWebsocket } from '../../src/websocket/app'
import { installAppAndDna, withConductor } from './util'
import { AgentPubKey, fakeAgentPubKey } from '../../src/api/types'
import { AppSignal } from '../../src/api/app'

const ADMIN_PORT = 33001

const TEST_ZOME_NAME = 'foo'

test('admin smoke test', withConductor(ADMIN_PORT, async t => {

  const installed_app_id = 'app'
  const admin = await AdminWebsocket.connect(`http://localhost:${ADMIN_PORT}`)

  const agent_key = await admin.generateAgentPubKey()
  t.ok(agent_key)

  await admin.installApp({
    installed_app_id, agent_key, dnas: []
  })

  const activeApps1 = await admin.listActiveApps()
  t.equal(activeApps1.length, 0)

  await admin.activateApp({ installed_app_id })

  const activeApps2 = await admin.listActiveApps()
  t.equal(activeApps2.length, 1)
  t.equal(activeApps2[0], installed_app_id)

  await admin.attachAppInterface({ port: 0 })
  await admin.deactivateApp({ installed_app_id })
  const dnas = await admin.listDnas()
  t.equal(dnas.length, 0)

  const activeApps3 = await admin.listActiveApps()
  t.equal(activeApps3.length, 0)
  // NB: missing dumpState because it requires a valid cell_id
}))


test('can call a zome function', withConductor(ADMIN_PORT, async t => {
  const [installed_app_id, cell_id, nick, client] = await installAppAndDna(ADMIN_PORT)
  const info = await client.appInfo({ installed_app_id })
  t.deepEqual(info.cell_data[0][0], cell_id)
  t.equal(info.cell_data[0][1], nick)
  const response = await client.callZome({
    // TODO: write a test with a real capability secret.
    cap: null,
    cell_id,
    zome_name: TEST_ZOME_NAME,
    fn_name: 'foo',
    provenance: fakeAgentPubKey('TODO'),
    payload: null,
  })
  t.equal(response, "foo")
}))

test('can receive a signal', withConductor(ADMIN_PORT, async t => {
  await new Promise(async (resolve, reject) => {
    try {
      const [installed_app_id, cell_id, _nick, client] = await installAppAndDna(ADMIN_PORT, signalCb)
      function signalCb (signal: AppSignal) {
        t.deepEqual(signal, {
          type: 'Signal',
          data: {
            cellId: cell_id,
            payload: 'i am a signal'
          }
        })
        resolve()
      }
      // trigger an emit_signal
      await client.callZome({
        cap: null,
        cell_id,
        zome_name: TEST_ZOME_NAME,
        fn_name: 'emitter',
        provenance: fakeAgentPubKey('TODO'),
        payload: null,
      })
    } catch (e) {
      reject(e)
    }
  })
}))

test(
  'callZome rejects appropriately for ZomeCallUnauthorized',
  withConductor(ADMIN_PORT, async (t) => {
    const [installed_app_id, cell_id, _nick, client] = await installAppAndDna(ADMIN_PORT)
    try {
      await client.callZome({
        // bad cap, on purpose
        cap: Buffer.from(
          // 64 bytes
          '0000000000000000000000000000000000000000000000000000000000000000'
            .split('')
            .map((x) => parseInt(x, 10))
        ),
        cell_id,
        zome_name: TEST_ZOME_NAME,
        fn_name: 'bar',
        provenance: fakeAgentPubKey('TODO'),
        payload: null,
      })
    } catch (e) {
      t.equal(e.type, 'error')
      t.equal(e.data.type, 'zome_call_unauthorized')
    }
  })
)

// no conductor
test('error is catchable when holochain socket is unavailable', async (t) => {
  const url = `http://localhost:${ADMIN_PORT}`
  try {
    await AdminWebsocket.connect(url)
  } catch (e) {
    t.equal(
      e.message,
      `could not connect to holochain conductor, please check that a conductor service is running and available at ${url}`
    )
  }

  try {
    await AppWebsocket.connect(url)
  } catch (e) {
    t.equal(
      e.message,
      `could not connect to holochain conductor, please check that a conductor service is running and available at ${url}`
    )
  }
})
