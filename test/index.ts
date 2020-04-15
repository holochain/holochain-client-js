import test from 'tape'
import * as msgpack from 'msgpack-lite'

import * as Api from '../src/api/admin'

test('admin api basic encode/decode', t => {
  const request: Api.InstallDnaRequest = { path: 'path/to/dna' }
  const response: Api.InstallDnaResponse = null
  const [msg, decoder] = Api.request(request)

  t.deepEqual(msgpack.decode(msg), request)
  t.deepEqual(decoder(msgpack.encode(response)), response)
  t.end()
})
