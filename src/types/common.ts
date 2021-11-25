export type HoloHash = Uint8Array; // length 39
export type AgentPubKey = HoloHash;
export type DnaHash = HoloHash;
export type EntryHash = HoloHash;
export type HeaderHash = HoloHash;

export type KitsuneAgent = Uint8Array;
export type KitsuneSpace = Uint8Array;

export type InstalledAppId = string;

export type Signature = Uint8Array;

export type CellId = [HoloHash, AgentPubKey];

export type DnaProperties = any;
export type RoleId = string;

export type InstalledCell = {
  cell_id: CellId;
  role_id: RoleId;
};
