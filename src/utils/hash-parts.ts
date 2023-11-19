import { ActionHash, AgentPubKey, EntryHash } from "../types.js";

/**
 * Get dht location (last 4 bytes) from a hash
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param A {@link Uint8Array}
 * @returns A {@link Uint8Array}.
 *
 * @public
 */
export async function sliceDhtLocation(
  input: AgentPubKey | EntryHash | ActionHash
): Promise<Uint8Array> {
  return Uint8Array.from(input.slice(36, 40));
}

/**
 * Get core (center 32 bytes) from a hash
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param A {@link Uint8Array}
 * @returns A {@link Uint8Array}.
 *
 * @public
 */
export async function sliceCore32(
  input: AgentPubKey | EntryHash | ActionHash
): Promise<Uint8Array> {
  return Uint8Array.from(input.slice(3, 36));
}

/**
 * Get hash type (initial 3 bytes) from a hash
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param A {@link Uint8Array}
 * @returns A {@link Uint8Array}.
 *
 * @public
 */
export async function sliceHashType(
  input: AgentPubKey | EntryHash | ActionHash
): Promise<Uint8Array> {
  return Uint8Array.from(input.slice(0, 3));
}
