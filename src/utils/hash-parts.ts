import { ActionHash, AgentPubKey, EntryHash } from "../types.js";
import blake2b from "@bitgo/blake2b";

/**
 * Hash type labels and their 3 byte values (forming the first 3 bytes of hash)
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @public
 */
export const hashTypePrefix = {
  Agent: Uint8Array.from([132, 32, 36]),
  Entry: Uint8Array.from([132, 33, 36]),
  Dna: Uint8Array.from([132, 45, 36]),
  Action: Uint8Array.from([132, 41, 36]),
  External: Uint8Array.from([132, 47, 36]),
};

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
  hash: AgentPubKey | EntryHash | ActionHash
): Promise<Uint8Array> {
  return Uint8Array.from(hash.slice(36, 40));
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
  hash: AgentPubKey | EntryHash | ActionHash
): Promise<Uint8Array> {
  return Uint8Array.from(hash.slice(3, 36));
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
  hash: AgentPubKey | EntryHash | ActionHash
): Promise<Uint8Array> {
  return Uint8Array.from(hash.slice(0, 3));
}

/**
 * Generate dht location (last 4 bytes) from a core hash (middle 32 bytes)
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param A {@link Uint8Array}
 * @returns A {@link Uint8Array}.
 *
 * @public
 */
export function dhtLocationFrom32(hashCore: Uint8Array): Uint8Array {
  const hash = new Uint8Array(16);
  blake2b(hash.length).update(hashCore).digest(hash);

  const out = hash.slice(0, 4);
  [4, 8, 12].forEach((i) => {
    out[0] ^= hash[i];
    out[1] ^= hash[i + 1];
    out[2] ^= hash[i + 2];
    out[3] ^= hash[i + 3];
  });

  return out;
}

/**
 * Generate full hash from a core hash (middle 32 bytes) and hash type label
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param A {@link Uint8Array}
 * @returns A {@link Uint8Array}.
 *
 * @public
 */
export function hashFrom32AndType(
  hashCore: AgentPubKey | EntryHash | ActionHash,
  hashType: "Agent" | "Entry" | "Dna" | "Action" | "External"
): Uint8Array {
  return Uint8Array.from([
    ...hashTypePrefix[hashType],
    ...hashCore,
    ...dhtLocationFrom32(hashCore),
  ]);
}
