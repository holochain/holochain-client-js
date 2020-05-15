
import * as msgpack from 'msgpack-lite'

// export const request = <Req, Res>(request: Req): [Buffer, Decoder<Res>] => [
//   msgpack.encode(request),
//   buf => msgpack.decode(buf)
// ]

export const tagged = <Req, Res>(tag: string, request: Requester<Tagged<Req>, Tagged<Res>>): Requester<Req, Res> => {
  return (req) => request({ data: req, type: tag }).then(res => res.data)
}

type Decoder<T> = (buf: Buffer) => T
export type Requester<Req, Res> = (req: Req) => Promise<Res>
export type Tagged<T> = { type: string, data: T }
