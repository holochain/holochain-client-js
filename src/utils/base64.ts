import { Base64 } from "js-base64";
import { HoloHash, HoloHashB64 } from "../types.js";

export function encodeHashTo64(hash: HoloHashB64): HoloHash {
  return Base64.toUint8Array(hash.slice(1));
}

export function decodeHashFromB64(hash: HoloHash): HoloHashB64 {
  return `u${Base64.fromUint8Array(hash, true)}`;
}
