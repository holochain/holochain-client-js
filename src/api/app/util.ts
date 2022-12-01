import crypto from "crypto";
import nacl from "tweetnacl";
import { CapSecret } from "../../hdk/capabilities.js";
import { AgentPubKey } from "../../types.js";
import { Nonce256Bit } from "./types.js";

/**
 * Generates a key pair for signing zome calls.
 *
 * @returns The signing key pair and an agent pub key based on the public key.
 */
export const generateSigningKeyPair = () => {
  const keyPair = nacl.sign.keyPair();
  const signingKey = new Uint8Array(
    [132, 32, 36].concat(...keyPair.publicKey).concat(...[0, 0, 0, 0])
  ) as AgentPubKey;
  const keys: [nacl.SignKeyPair, AgentPubKey] = [keyPair, signingKey];
  return keys;
};

export const randomCapSecret: () => CapSecret = () => randomByteArray(64);

export const randomNonce: () => Nonce256Bit = () => randomByteArray(32);

const randomByteArray = (length: number) => {
  if (window && "crypto" in window && "getRandomValues" in window.crypto) {
    return window.crypto.getRandomValues(new Uint8Array(length));
  } else {
    return new Uint8Array(crypto.randomBytes(length));
  }
};
