import test from 'tape'
import * as msgpack from 'msgpack-lite'

import * as Admin from '../src/api/admin'
import * as Common from '../src/api/common'

test('admin api basic encode/decode', t => {
  const request: Admin.InstallDnaRequest = { path: 'path/to/dna' }
  const response: Admin.InstallDnaResponse = null
  const [msg, decoder] = Common.request(request)

  t.deepEqual(msgpack.decode(msg), request)
  t.deepEqual(decoder(msgpack.encode(response)), response)
  t.end()
})
