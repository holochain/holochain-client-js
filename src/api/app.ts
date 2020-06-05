import { Requester } from "./common"
import { CellId, AgentPubKey, AppId, InstalledCell, InstalledApp } from "./types"

export type CallZomeRequest = {
  cap: string,
  cell_id: CellId,
  zome_name: string,
  fn_name: string,
  payload: any,  // TODO: should this be byte array?
  provenance: AgentPubKey,
}
export type CallZomeResponse = Buffer

export type AppInfoRequest = { app_id: AppId }
export type AppInfoResponse = InstalledApp

export interface AppApi {
  appInfo: Requester<AppInfoRequest, AppInfoResponse>,
  callZome: Requester<CallZomeRequest, CallZomeResponse>,
}
