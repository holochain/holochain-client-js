export type HoloHash = Buffer // length 39
export type AgentPubKey = HoloHash
export type InstalledAppId = string
export type CapSecret = Buffer
export type CellId = [HoloHash, AgentPubKey]
export type CellNick = string
export type DnaProperties = any
export type InstalledApp = {
  installed_app_id: InstalledAppId,
  cell_data: Array<InstalledCell>,
}
export type InstalledCell = [CellId, CellNick]
export type MembraneProof = Buffer

export const fakeAgentPubKey = (x: any) =>
  Buffer.from(
    [0x84, 0x20, 0x24].concat(
      '000000000000000000000000000000000000'
        .split('')
        .map((x) => parseInt(x, 10))
    )
  )
