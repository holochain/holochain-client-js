import blake2b from "@bitgo/blake2b";
import { HoloHash } from "../types.js";

const HASH_TYPE_START = 0;
const HASH_TYPE_BYTE_LENGTH = 3;
const CORE_HASH_BYTE_LENGTH = 32;
const DHT_LOCATION_BYTE_LENGTH = 4;

/**
 * Hash type labels and their 3 byte values (forming the first 3 bytes of hash).
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @public
 */
export const HASH_TYPE_PREFIX = {
  Agent: Uint8Array.from([132, 32, 36]),
  Entry: Uint8Array.from([132, 33, 36]),
  Dna: Uint8Array.from([132, 45, 36]),
  Action: Uint8Array.from([132, 41, 36]),
  External: Uint8Array.from([132, 47, 36]),
};

/**
 * Get hash type (initial 3 bytes) from a hash.
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param hash - The full 39 byte hash.
 * @returns The initial 3 bytes of the hash.
 *
 * @public
 */
export function sliceHashType(
  hash: HoloHash | Uint8Array,
): Uint8Array {
  if (!(hash instanceof HoloHash))
    hash = new HoloHash(hash);
  return (hash as HoloHash).getPrefix()
}

/**
 * Get core hash from a Holochain hash (32 bytes).
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param hash - The full 39 byte hash.
 * @returns The core 32 bytes of the hash.
 *
 * @public
 */
export function sliceCore32(
  hash: HoloHash | Uint8Array,
): Uint8Array {
  if (!(hash instanceof HoloHash))
    hash = new HoloHash(hash);
  const start = HASH_TYPE_START + HASH_TYPE_BYTE_LENGTH;
  const end = start + CORE_HASH_BYTE_LENGTH;
  return (hash as HoloHash).bytes(start, end);
}

/**
 * Get DHT location (last 4 bytes) from a hash.
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param hash - The full 39 byte hash.
 * @returns The last 4 bytes of the hash.
 *
 * @public
 */
export function sliceDhtLocation(
  hash: HoloHash | Uint8Array,
): Uint8Array {
  if (!(hash instanceof HoloHash))
    hash = new HoloHash(hash);
  const start = HASH_TYPE_START + HASH_TYPE_BYTE_LENGTH + CORE_HASH_BYTE_LENGTH;
  const end = start + DHT_LOCATION_BYTE_LENGTH;
  return (hash as HoloHash).bytes(start, end);
}

/**
 * Generate DHT location (last 4 bytes) from a core hash (middle 32 bytes).
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param hashCore - The core 32 bytes of the hash.
 * @returns The last 4 bytes of the hash.
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
 * Generate full hash from a core hash (middle 32 bytes) and hash type label.
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param hashCore - The core 32 bytes of the hash.
 * @param hashType - The type of the hash.
 * @returns The full 39 byte hash.
 *
 * @public
 */
export function hashFrom32AndType(
  hashCore: Uint8Array,
  hashType: "Agent" | "Entry" | "Dna" | "Action" | "External"
): Uint8Array {
  return (new HoloHash(hashCore))
    .toType(hashType === "Agent" ? "AgentPubKey" : hashType + "Hash");
}
