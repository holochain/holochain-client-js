import { ed25519 } from "@noble/curves/ed25519";
import { randomBytes } from "@noble/hashes/utils";
import type { CapSecret } from "../hdk/capabilities.js";
import type { AgentPubKey, CellId } from "../types.js";
import { encodeHashToBase64 } from "../utils/base64.js";

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
 * @param agentPubKey - The agent pub key to take 4 last bytes (= DHT location)
 * from (optional).
 * @returns The signing key pair and an agent pub key based on the public key.
 *
 * @public
 */
export const generateSigningKeyPair: (
  agentPubKey?: AgentPubKey
) => Promise<[KeyPair, AgentPubKey]> = async (agentPubKey?: AgentPubKey) => {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  const keyPair: KeyPair = { privateKey, publicKey };
  const locationBytes = agentPubKey ? agentPubKey.subarray(35) : [0, 0, 0, 0];
  const signingKey = new Uint8Array(
    [132, 32, 36].concat(...keyPair.publicKey).concat(...locationBytes)
  );
  return [keyPair, signingKey];
};

/**
 * @public
 */
export const randomCapSecret: () => Promise<CapSecret> = async () =>
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
  return randomBytes(length);
};

/**
 * @public
 */
export const getNonceExpiration = () => (Date.now() + 5 * 60 * 1000) * 1000; // 5 mins from now in microseconds
