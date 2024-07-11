import {
  HoloHash,
  AgentPubKey,
  DnaHash,
  WasmHash,
  EntryHash,
  ActionHash,
  AnyDhtHash,
  AnyLinkableHash,
  ExternalHash,
} from "@spartan-hc/holo-hash";

/**
 * @public
 */
export {
  HoloHash,
  AgentPubKey,
  DnaHash,
  WasmHash,
  EntryHash,
  ActionHash,
  AnyDhtHash,
  AnyLinkableHash,
  ExternalHash,
}

/**
 * @public
 */
export type KitsuneAgent = Uint8Array;
/**
 * @public
 */
export type KitsuneSpace = Uint8Array;

/** Base64 hash types */

/**
 * @public
 */
export type HoloHashB64 = string;
/**
 * @public
 */
export type AgentPubKeyB64 = HoloHashB64;
/**
 * @public
 */
export type DnaHashB64 = HoloHashB64;
/**
 * @public
 */
export type WasmHashB64 = HoloHashB64;
/**
 * @public
 */
export type EntryHashB64 = HoloHashB64;
/**
 * @public
 */
export type ActionHashB64 = HoloHashB64;
/**
 * @public
 */
export type AnyDhtHashB64 = HoloHashB64;

/**
 * @public
 */
export type InstalledAppId = string;

/**
 * @public
 */
export type Signature = Uint8Array;

/**
 * @public
 */
export type CellId = [DnaHash, AgentPubKey];

/**
 * @public
 */
export type DnaProperties = unknown;
/**
 * @public
 */
export type RoleName = string;

/**
 * @public
 */
export type InstalledCell = {
  cell_id: CellId;
  role_name: RoleName;
};

/**
 * @public
 */
export type Timestamp = number;
/**
 * @public
 */
export interface Duration {
  secs: number;
  nanos: number;
}

/**
 * @public
 */
export interface HoloHashed<T> {
  hash: HoloHash;
  content: T;
}

/**
 * @public
 */
export interface NetworkInfo {
  fetch_pool_info: FetchPoolInfo;
  current_number_of_peers: number;
  arc_size: number;
  total_network_peers: number;
  bytes_since_last_time_queried: number;
  completed_rounds_since_last_time_queried: number;
}

/**
 * @public
 */
export interface FetchPoolInfo {
  /// Total number of bytes expected to be received through fetches
  op_bytes_to_fetch: number;
  /// Total number of ops expected to be received through fetches
  num_ops_to_fetch: number;
}
