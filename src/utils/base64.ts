import { Base64 } from "js-base64";
import { HoloHashB64 } from "../types.js";
import { HoloHash } from "@spartan-hc/holo-hash";

/**
 * Decodes a Base64 encoded string to a byte array hash.
 *
 * @param hash - The Base64 encoded string to decode.
 * @returns The hash in byte format.
 *
 * @public
 */
export function decodeHashFromBase64(hash: string): HoloHash {
  return new HoloHash( hash );
}

/**
 * Encode a byte array hash to a Base64 string.
 *
 * @param hash - The hash to encode to a Base64 string.
 * @returns The Base64 encoded string
 *
 * @public
 */
export function encodeHashToBase64(hash: Uint8Array): HoloHashB64 {
  return String(new HoloHash( hash ));
}
