
import * as msgpack from 'msgpack-lite'

export const request = <Req, Res>(request: Req): [Buffer, Decoder<Res>] => [
  msgpack.encode(request),
  buf => msgpack.decode(buf)
]

type Decoder<T> = (buf: Buffer) => T
export type Requester<Req, Res> = (req: Req) => Promise<Res>

export type InstallDnaRequest = { path: string }
export type InstallDnaResponse = null

export type AddCellRequest = { todo: void }
export type AddCellResponse = { todo: void }

export interface AdminApi {
  installDna: Requester<InstallDnaRequest, InstallDnaResponse>
  addCell: Requester<AddCellRequest, AddCellResponse>
}
