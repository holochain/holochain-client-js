
export type AgentPubKey = string
export type AppId = string
export type CellId = [Hash, AgentPubKey]
export type CellNick = string
export type DnaProperties = any
export type Hash = string
export type InstalledApp = {
  app_id: AppId,
  cell_data: Array<InstalledCell>,
}
export type InstalledCell = [CellId, CellNick]
export type MembraneProof = Buffer
