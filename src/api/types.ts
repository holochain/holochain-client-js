export type HoloHash = Buffer // length 39
export type AgentPubKey = HoloHash
export type InstalledAppId = string
export type CapSecret = Buffer
export type CellId = [HoloHash, AgentPubKey]
export type CellNick = string
export type DnaProperties = any
export type SlotId = string;

export type AppSlot = {
    base_cell_id: CellId,
    is_provisioned: boolean,
    clone_limit: number,
    clones: Array<CellId>,
}

export type InstalledApp = {
  installed_app_id: InstalledAppId,
  _agent_key: AgentPubKey,
  slots: {[key:string]: AppSlot},
}

export type InstalledCell = {
    cell_id: CellId,
    cell_nick: CellNick,
}
export type InstalledAppInfo = {
    installed_app_id: InstalledAppId,
    cell_data: Array<InstalledCell>
    active: boolean
}
export type MembraneProof = Buffer

export const fakeAgentPubKey = (x: any) =>
  Buffer.from(
    [0x84, 0x20, 0x24].concat(
      '000000000000000000000000000000000000'
        .split('')
        .map((x) => parseInt(x, 10))
    )
  )
