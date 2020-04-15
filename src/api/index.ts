
import * as msgpack from 'msgpack-lite'

export const request = <Req, Res>(request: Req): [Buffer, Decoder<Res>] => [
  msgpack.encode(request),
  buf => msgpack.decode(buf)
]

type Decoder<T> = (buf: Buffer) => T
export type Requester<Req, Res> = (req: Req) => Promise<Res>
