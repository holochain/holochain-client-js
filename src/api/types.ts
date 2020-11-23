
// TODO: update when HoloHash structure becomes simple byte array
export type AgentPubKey = {
  hash: Buffer,
  hash_type: Buffer,
}
export type Hash = {
  hash: Buffer,
  hash_type: Buffer,
}
export type InstalledAppId = string
export type CapSecret = Buffer
export type CellId = [Hash, AgentPubKey]
export type CellNick = string
export type DnaProperties = any
export type InstalledApp = {
  installed_app_id: InstalledAppId,
  cell_data: Array<InstalledCell>,
}
export type InstalledCell = [CellId, CellNick]
export type MembraneProof = Buffer

export const fakeAgentPubKey = (x: any) => ({
  hash: Buffer.from("000000000000000000000000000000000000".split('').map(x => parseInt(x, 10))),
  hash_type: Buffer.from([0x84, 0x20, 0x24])
})
