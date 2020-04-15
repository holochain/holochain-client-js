import test from 'tape'
import * as msgpack from 'msgpack-lite'

import admin, { InstallDnaRequest, InstallDnaResponse } from '../src/api/admin'

test('admin api basic encode/decode', t => {
  const request: InstallDnaRequest = { path: 'path/to/dna' }
  const response: InstallDnaResponse = null
  const [msg, decoder] = admin.installDna(request)

  t.deepEqual(msgpack.decode(msg), request)
  t.deepEqual(decoder(msgpack.encode(response)), response)
  t.end()
})
