export type HoloHash = Uint8Array; // length 39
export type AgentPubKey = HoloHash;
export type DnaHash = HoloHash;
export type WasmHash = HoloHash;
export type EntryHash = HoloHash;
export type ActionHash = HoloHash;
export type AnyDhtHash = HoloHash;

export type KitsuneAgent = Uint8Array;
export type KitsuneSpace = Uint8Array;

/** Base64 hash types */

export type HoloHashB64 = string;
export type AgentPubKeyB64 = HoloHashB64;
export type DnaHashB64 = HoloHashB64;
export type WasmHashB64 = HoloHashB64;
export type EntryHashB64 = HoloHashB64;
export type ActionHashB64 = HoloHashB64;
export type AnyDhtHashB64 = HoloHashB64;

export type InstalledAppId = string;

export type Signature = Uint8Array;

export type CellId = [DnaHash, AgentPubKey];

export type DnaProperties = any;
export type RoleName = string;

export type InstalledCell = {
  cell_id: CellId;
  role_name: RoleName;
};

export type Timestamp = number;

export interface HoloHashed<T> {
  hash: HoloHash;
  content: T;
}

export interface NetworkInfo {
  fetch_queue_info: FetchQueueInfo;
}

export interface FetchQueueInfo {
  /// Total number of bytes expected to be received through fetches
  op_bytes_to_fetch: number;
  /// Total number of ops expected to be received through fetches
  num_ops_to_fetch: number;
}
