import { Requester } from "."

export type CallZomeRequest = { todo: void }
export type CallZomeResponse = { todo: void }

export interface AppApi {
  callZome: Requester<CallZomeRequest, CallZomeResponse>
}
