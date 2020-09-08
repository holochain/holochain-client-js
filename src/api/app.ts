import { Requester } from "./common"
import { CellId, CapSecret, AgentPubKey, AppId, InstalledApp } from "./types"

export type CallZomeRequestGeneric<Payload> = {
  cap: CapSecret,
  cell_id: CellId,
  zome_name: string,
  fn_name: string,
  payload: Payload,
  provenance: AgentPubKey,
}
export type CallZomeResponseGeneric<Payload> = Payload
export type CallZomeRequest = CallZomeRequestGeneric<any>
export type CallZomeResponse = CallZomeResponseGeneric<any>

export type AppInfoRequest = { app_id: AppId }
export type AppInfoResponse = InstalledApp

export interface AppApi {
  appInfo: Requester<AppInfoRequest, AppInfoResponse>,
  callZome: Requester<CallZomeRequest, CallZomeResponse>,
}
