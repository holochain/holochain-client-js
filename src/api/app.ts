import { Requester } from "./common"
import { CellId, AgentPubKey } from "./types"

export type CallZomeRequest = {
  cap: string,
  cell_id: CellId,
  zome_name: string,
  fn_name: string,
  payload: any,  // TODO: should this be byte array?
  provenance: AgentPubKey,
}
export type CallZomeResponse = { todo: void }

export interface AppApi {
  callZome: Requester<CallZomeRequest, CallZomeResponse>
}
