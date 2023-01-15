import nacl from "tweetnacl";
import { CapSecret } from "../hdk/capabilities.js";
import { AgentPubKey, CellId } from "../types.js";
import { encodeHashToBase64 } from "../utils/base64.js";

export type Nonce256Bit = Uint8Array;

export interface SigningCredentials {
  capSecret: CapSecret;
  keyPair: nacl.SignKeyPair;
  signingKey: AgentPubKey;
}

const signingCredentials: Map<string, SigningCredentials> = new Map();

/**
 * Get credentials for signing zome calls.
 *
 * @param cellId - Cell id to get credentials of.
 * @returns The keys and cap secret required for signing a zome call.
 */
export const getSigningCredentials = (cellId: CellId) => {
  const cellIdB64 = encodeHashToBase64(cellId[0]).concat(
    encodeHashToBase64(cellId[1])
  );
  return signingCredentials.get(cellIdB64);
};

/**
 * Set credentials for signing zome calls.
 *
 * @param cellId - Cell id to set credentials for.
 * @param cellId - Cell id to set credentials for.
 */
export const setSigningCredentials = (
  cellId: CellId,
  credentials: SigningCredentials
) => {
  const cellIdB64 = encodeHashToBase64(cellId[0]).concat(
    encodeHashToBase64(cellId[1])
  );
  signingCredentials.set(cellIdB64, credentials);
};

/**
 * Generates a key pair for signing zome calls.
 *
 * @returns The signing key pair and an agent pub key based on the public key.
 */
export const generateSigningKeyPair: () => [
  nacl.SignKeyPair,
  AgentPubKey
] = () => {
  const keyPair = nacl.sign.keyPair();
  const signingKey = new Uint8Array(
    [132, 32, 36].concat(...keyPair.publicKey).concat(...[0, 0, 0, 0])
  );
  return [keyPair, signingKey];
};

export const randomCapSecret: () => Promise<CapSecret> = () =>
  randomByteArray(64);

export const randomNonce: () => Promise<Nonce256Bit> = async () =>
  randomByteArray(32);

export const randomByteArray = async (length: number) => {
  if (
    typeof window !== "undefined" &&
    "crypto" in window &&
    "getRandomValues" in window.crypto
  ) {
    return window.crypto.getRandomValues(new Uint8Array(length));
  } else {
    const crypto = await import("crypto");
    return new Uint8Array(crypto.randomBytes(length));
  }
};

export const getNonceExpiration = () => (Date.now() + 5 * 60 * 1000) * 1000; // 5 mins from now in microseconds
