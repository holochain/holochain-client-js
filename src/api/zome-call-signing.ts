import * as ed25519 from "@noble/ed25519";
import { CapSecret } from "../hdk/capabilities.js";
import { AgentPubKey, CellId } from "../types.js";
import { encodeHashToBase64 } from "../utils/base64.js";

// shim for Nodejs <= v18
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as unknown as Crypto;

/**
 * @public
 */
export type Nonce256Bit = Uint8Array;

/**
 * @public
 */
export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/**
 * @public
 */
export interface SigningCredentials {
  capSecret: CapSecret;
  keyPair: KeyPair;
  signingKey: AgentPubKey;
}

const signingCredentials: Map<string, SigningCredentials> = new Map();

/**
 * Get credentials for signing zome calls.
 *
 * @param cellId - Cell id to get credentials of.
 * @returns The keys and cap secret required for signing a zome call.
 *
 * @public
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
 *
 * @public
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
 *
 * @public
 */
export const generateSigningKeyPair: () => Promise<
  [KeyPair, AgentPubKey]
> = async () => {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);
  const keyPair: KeyPair = { privateKey, publicKey };
  const signingKey = new Uint8Array(
    [132, 32, 36].concat(...publicKey).concat(...[0, 0, 0, 0])
  );
  return [keyPair, signingKey];
};

/**
 * @public
 */
export const randomCapSecret: () => Promise<CapSecret> = () =>
  randomByteArray(64);

/**
 * @public
 */
export const randomNonce: () => Promise<Nonce256Bit> = async () =>
  randomByteArray(32);

/**
 * @public
 */
export const randomByteArray = async (length: number) => {
  if (
    globalThis.window &&
    "crypto" in globalThis.window &&
    "getRandomValues" in globalThis.window.crypto
  ) {
    return globalThis.window.crypto.getRandomValues(new Uint8Array(length));
  } else {
    const crypto = await import("node:crypto");
    return new Uint8Array(crypto.randomBytes(length));
  }
};

/**
 * @public
 */
export const getNonceExpiration = () => (Date.now() + 5 * 60 * 1000) * 1000; // 5 mins from now in microseconds
