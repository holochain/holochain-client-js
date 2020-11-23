import { Requester } from "./common"
import { AgentPubKey, MembraneProof, DnaProperties, InstalledAppId, CellId, CellNick, InstalledApp } from "./types"

export type ActivateAppRequest = { installed_app_id: InstalledAppId }
export type ActivateAppResponse = null

export type AttachAppInterfaceRequest = { port: number }
export type AttachAppInterfaceResponse = { port: number }

export type DeactivateAppRequest = { installed_app_id: InstalledAppId }
export type DeactivateAppResponse = null

export type DumpStateRequest = { cell_id: CellId }
export type DumpStateResponse = any

export type GenerateAgentPubKeyRequest = void
export type GenerateAgentPubKeyResponse = AgentPubKey

export type InstallAppRequest = {
  installed_app_id: InstalledAppId,
  agent_key: AgentPubKey,
  dnas: Array<InstallAppDnaPayload>,
}
export type InstallAppResponse = InstalledApp

export type ListDnasRequest = void
export type ListDnasResponse = Array<string>

export type ListCellIdsRequest = void
export type ListCellIdsResponse = Array<CellId>

export type ListActiveAppsRequest = void
export type ListActiveAppsResponse = Array<InstalledAppId>

export interface AdminApi {
  activateApp: Requester<ActivateAppRequest, ActivateAppResponse>
  attachAppInterface: Requester<AttachAppInterfaceRequest, AttachAppInterfaceResponse>
  deactivateApp: Requester<DeactivateAppRequest, DeactivateAppResponse>
  dumpState: Requester<DumpStateRequest, DumpStateResponse>
  generateAgentPubKey: Requester<GenerateAgentPubKeyRequest, GenerateAgentPubKeyResponse>
  installApp: Requester<InstallAppRequest, InstallAppResponse>
  listDnas: Requester<ListDnasRequest, ListDnasResponse>
  listCellIds: Requester<ListCellIdsRequest, ListCellIdsResponse>
  listActiveApps: Requester<ListActiveAppsRequest, ListActiveAppsResponse>
}


type InstallAppDnaPayload = {
  path: string,
  nick: CellNick,
  properties?: DnaProperties,
  membrane_proof?: MembraneProof
}
