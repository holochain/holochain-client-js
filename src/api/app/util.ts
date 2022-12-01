import nacl from "tweetnacl";
import { AgentPubKey } from "../../types.js";

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
