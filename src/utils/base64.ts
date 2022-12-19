import { Base64 } from "js-base64";
import { HoloHash, HoloHashB64 } from "../types.js";

export function deserializeHash(hash: HoloHashB64): HoloHash {
  return Base64.toUint8Array(hash.slice(1));
}

export function serializeHash(hash: HoloHash): HoloHashB64 {
  return `u${Base64.fromUint8Array(hash, true)}`;
}
