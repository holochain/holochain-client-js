import { Requester } from "./common"
import { AgentPubKey, MembraneProof, DnaProperties, AppId, CellId, Hash } from "./types"

export type ActivateAppRequest = { app_id: AppId }
export type ActivateAppResponse = null

export type DeactivateAppRequest = { app_id: AppId }
export type DeactivateAppResponse = null

export type InstallAppRequest = {
  app_id: AppId,
  agent_key: AgentPubKey,
  dnas: Array<[String, DnaProperties | null]>,
  proofs: Record<Hash, MembraneProof>
}
export type InstallAppResponse = Array<CellId>

export type ListDnasRequest = null
export type ListDnasResponse = Array<string>

export type AttachAppInterfaceRequest = { port: number }
export type AttachAppInterfaceResponse = { port: number }

export type DumpStateRequest = { cell_id: CellId }
export type DumpStateResponse = { cell_id: CellId }

export type GenerateAgentPubKeyRequest = void
export type GenerateAgentPubKeyResponse = AgentPubKey

export interface AdminApi {
  installApp: Requester<InstallAppRequest, InstallAppResponse>
  listDnas: Requester<ListDnasRequest, ListDnasResponse>
  dumpState: Requester<DumpStateRequest, DumpStateResponse>
  generateAgentPubKey: Requester<GenerateAgentPubKeyRequest, GenerateAgentPubKeyResponse>
  attachAppInterface: Requester<AttachAppInterfaceRequest, AttachAppInterfaceResponse>
}
