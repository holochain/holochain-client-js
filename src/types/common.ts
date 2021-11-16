export type HoloHash = Buffer; // length 39
export type AgentPubKey = HoloHash;
export type DnaHash = HoloHash;
export type EntryHash = HoloHash;
export type HeaderHash = HoloHash;

export type KitsuneAgent = Buffer;
export type KitsuneSpace = Buffer;

export type InstalledAppId = string;

export type CapSecret = Buffer;
export type Signature = Buffer;

export type CellId = [HoloHash, AgentPubKey];

export type DnaProperties = any;
export type RoleId = string;

export type InstalledCell = {
  cell_id: CellId;
  role_id: RoleId;
};
