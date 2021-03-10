const test = require('tape')

import { AdminWebsocket } from '../../src/websocket/admin'
import { AppWebsocket } from '../../src/websocket/app'
import { installAppAndDna, withConductor, launch, writeConfig, CONFIG_PATH, CONFIG_PATH_1, FIXTURE_PATH } from '../e2e/util'
import { AgentPubKey, fakeAgentPubKey } from '../../src/api/types'
import { AppSignal } from '../../src/api/app'
import zlib from 'zlib';
import fs from 'fs';
import { DnaFile } from '../../src/api/admin'
import { decode } from '@msgpack/msgpack'

const ADMIN_PORT = 4444

test('Timeout bug...', async t => {
    try {
      function signalCb (signal: AppSignal) {
        console.log("Signal: ", signal);
      }
      const [installed_app_id, cell_id, _nick, client] = await installAppAndDna(ADMIN_PORT, signalCb)
      try {
      let response =  await client.callZome({
        cap: null,
        cell_id,
        zome_name: 'test',
        fn_name: 'returns_obj',
        provenance: fakeAgentPubKey('TODO'),
        payload: null,
      })
      console.log("Response: ", response);
      let response_two =  await client.callZome({
        cap: null,
        cell_id,
        zome_name: 'test',
        fn_name: 'create_link',
        provenance: fakeAgentPubKey('TODO'),
        payload: null,
      })
      console.log("Second Response: ", response_two);

    } catch (e) {
      console.log("Error", e);
    }

    try {
      let response_one =  await client.callZome({
        cap: null,
        cell_id,
        zome_name: 'test',
        fn_name: 'create_link',
        provenance: fakeAgentPubKey('TODO'),
        payload: null,
      })
      console.log("Thrid Response: ", response_one);
    }
    catch (e) {
      console.log("ERROR: ", e);

    }




    } catch (e) {
      t.fail()
    }
})
