import { Requester } from "./common"
import { AgentPubKey, MembraneProof, DnaProperties, AppId, CellId, CellNick, InstalledApp } from "./types"

export type ActivateAppRequest = { app_id: AppId }
export type ActivateAppResponse = null

export type AttachAppInterfaceRequest = { port: number }
export type AttachAppInterfaceResponse = { port: number }

export type DeactivateAppRequest = { app_id: AppId }
export type DeactivateAppResponse = null

export type DumpStateRequest = { cell_id: CellId }
export type DumpStateResponse = any

export type GenerateAgentPubKeyRequest = void
export type GenerateAgentPubKeyResponse = AgentPubKey

export type InstallAppRequest = {
  app_id: AppId,
  agent_key: AgentPubKey,
  dnas: Array<InstallAppDnaPayload>,
}
export type InstallAppResponse = InstalledApp

export type ListDnasRequest = void
export type ListDnasResponse = Array<string>

export type ListCellIdsRequest = void
export type ListCellIdsResponse = Array<CellId>

export type ListActiveAppIdsRequest = void
export type ListActiveAppIdsResponse = Array<AppId>

export interface AdminApi {
  activateApp: Requester<ActivateAppRequest, ActivateAppResponse>
  attachAppInterface: Requester<AttachAppInterfaceRequest, AttachAppInterfaceResponse>
  deactivateApp: Requester<DeactivateAppRequest, DeactivateAppResponse>
  dumpState: Requester<DumpStateRequest, DumpStateResponse>
  generateAgentPubKey: Requester<GenerateAgentPubKeyRequest, GenerateAgentPubKeyResponse>
  installApp: Requester<InstallAppRequest, InstallAppResponse>
  listDnas: Requester<ListDnasRequest, ListDnasResponse>
  listCellIds: Requester<ListCellIdsRequest, ListCellIdsResponse>
  listActiveAppIds: Requester<ListActiveAppIdsRequest, ListActiveAppIdsResponse>
}


type InstallAppDnaPayload = {
  path: string,
  nick: CellNick,
  properties?: DnaProperties,
  membrane_proof?: MembraneProof
}
