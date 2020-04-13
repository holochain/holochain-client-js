
import * as msgpack from 'msgpack-lite'

const installDna = (request: InstallDnaRequest): [Buffer, Decoder<InstallDnaResponse>] => [
  msgpack.encode(request),
  buf => msgpack.decode(buf)
]

export default {
  installDna
}

type Decoder<T> = (buf: Buffer) => T

export type InstallDnaRequest = { path: string }
export type InstallDnaResponse = null
