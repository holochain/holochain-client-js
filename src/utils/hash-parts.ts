import { encode } from "@msgpack/msgpack";
import { HoloHash, HoloHashType } from "../types.js";
import blake2b from "@bitgo/blake2b";
import isEqual from "lodash-es/isEqual.js";

const HASH_TYPE_START = 0;
const HASH_TYPE_BYTE_LENGTH = 3;
const CORE_HASH_BYTE_LENGTH = 32;
const DHT_LOCATION_BYTE_LENGTH = 4;

const HASH_TYPE_PREFIX_U8 = {
  [HoloHashType.Agent]: [132, 32, 36],
  [HoloHashType.Entry]: [132, 33, 36],
  [HoloHashType.DhtOp]: [132, 36, 36],
  [HoloHashType.Warrant]: [132, 44, 36],
  [HoloHashType.Dna]: [132, 45, 36],
  [HoloHashType.Action]: [132, 41, 36],
  [HoloHashType.Wasm]: [132, 42, 36],
  [HoloHashType.External]: [132, 47, 36],
};

/**
 * Hash type labels mapped to their 3 byte values (forming the first 3 bytes of hash).
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @public
 */
export const HASH_TYPE_PREFIX = {
  [HoloHashType.Agent]: Uint8Array.from(
    HASH_TYPE_PREFIX_U8[HoloHashType.Agent],
  ),
  [HoloHashType.Entry]: Uint8Array.from(
    HASH_TYPE_PREFIX_U8[HoloHashType.Entry],
  ),
  [HoloHashType.DhtOp]: Uint8Array.from(
    HASH_TYPE_PREFIX_U8[HoloHashType.DhtOp],
  ),
  [HoloHashType.Warrant]: Uint8Array.from(
    HASH_TYPE_PREFIX_U8[HoloHashType.Warrant],
  ),
  [HoloHashType.Dna]: Uint8Array.from(HASH_TYPE_PREFIX_U8[HoloHashType.Dna]),
  [HoloHashType.Action]: Uint8Array.from(
    HASH_TYPE_PREFIX_U8[HoloHashType.Action],
  ),
  [HoloHashType.Wasm]: Uint8Array.from(HASH_TYPE_PREFIX_U8[HoloHashType.Wasm]),
  [HoloHashType.External]: Uint8Array.from(
    HASH_TYPE_PREFIX_U8[HoloHashType.External],
  ),
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
export function sliceHashType(hash: HoloHash): Uint8Array {
  return Uint8Array.from(hash.slice(0, 3));
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
export function sliceCore32(hash: HoloHash): Uint8Array {
  const start = HASH_TYPE_START + HASH_TYPE_BYTE_LENGTH;
  const end = start + CORE_HASH_BYTE_LENGTH;
  return Uint8Array.from(hash.slice(start, end));
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
export function sliceDhtLocation(hash: HoloHash): Uint8Array {
  const start = HASH_TYPE_START + HASH_TYPE_BYTE_LENGTH + CORE_HASH_BYTE_LENGTH;
  const end = start + DHT_LOCATION_BYTE_LENGTH;
  return Uint8Array.from(hash.slice(start, end));
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
 * Get hash type of a hash, by reading the first 3 bytes.
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param hash - The full 39 byte hash.
 * @returns The HashType
 *
 * @public
 */
export function getHashType(hash: HoloHash): HoloHashType {
  const hashTypeBytes = Array.from(hash.slice(0, 3));
  const res = Object.entries(HASH_TYPE_PREFIX_U8).find(([, val]) =>
    isEqual(val, hashTypeBytes),
  );

  if (res === undefined) {
    throw new Error("First 3 bytes of hash do not match any known HashType");
  }

  return res[0] as HoloHashType;
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
  hashCore: HoloHash,
  hashType: HoloHashType,
): Uint8Array {
  return Uint8Array.from([
    ...HASH_TYPE_PREFIX[hashType],
    ...hashCore,
    ...dhtLocationFrom32(hashCore),
  ]);
}

/**
 * Generate full hash from some data content and hash type label.
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param content - The data to hash.
 * @param hashType - The type of the hash.
 * @returns The full 39 byte hash.
 *
 * @public
 */
export function hashFromContentAndType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any,
  hashType: HoloHashType,
): Uint8Array {
  const hashCore = new Uint8Array(32);
  blake2b(hashCore.length).update(encode(content)).digest(hashCore);

  return Uint8Array.from([
    ...HASH_TYPE_PREFIX[hashType],
    ...hashCore,
    ...dhtLocationFrom32(hashCore),
  ]);
}
