import { hashZomeCall } from "@holochain/serialization";
import { encode } from "@msgpack/msgpack";
import crypto from "crypto";
import nacl from "tweetnacl";
import { CapSecret } from "../../hdk/capabilities.js";
import { AgentPubKey, CellId } from "../../types.js";
import { FunctionName, ZomeName } from "../admin/types.js";
import { AdminWebsocket } from "../admin/websocket.js";
import {
  CallZomeRequestSigned,
  CallZomeRequestUnsigned,
  Nonce256Bit,
} from "./websocket.js";

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
  if (
    typeof window !== "undefined" &&
    "crypto" in window &&
    "getRandomValues" in window.crypto
  ) {
    return window.crypto.getRandomValues(new Uint8Array(length));
  } else {
    return new Uint8Array(crypto.randomBytes(length));
  }
};

export const getNonceExpiration = () => (Date.now() + 5 * 60 * 1000) * 1000; // 5 mins from now in microseconds

export const grantSigningKey = async (
  admin: AdminWebsocket,
  cellId: CellId,
  functions: Array<[ZomeName, FunctionName]>,
  signingKey: AgentPubKey
): Promise<CapSecret> => {
  const capSecret = randomCapSecret();
  await admin.grantZomeCallCapability({
    cell_id: cellId,
    cap_grant: {
      tag: "zome-call-signing-key",
      functions,
      access: {
        Assigned: {
          secret: capSecret,
          assignees: [signingKey],
        },
      },
    },
  });
  return capSecret;
};

export const signZomeCall = async (
  capSecret: CapSecret,
  signingKey: AgentPubKey,
  keyPair: nacl.SignKeyPair,
  payload: any
) => {
  const unsignedZomeCallPayload: CallZomeRequestUnsigned = {
    cap_secret: capSecret,
    cell_id: payload.cell_id,
    zome_name: payload.zome_name,
    fn_name: payload.fn_name,
    provenance: signingKey,
    payload: encode(payload.payload),
    nonce: randomNonce(),
    expires_at: getNonceExpiration(),
  };
  const hashedZomeCall = await hashZomeCall(unsignedZomeCallPayload);
  const signature = nacl
    .sign(hashedZomeCall, keyPair.secretKey)
    .subarray(0, nacl.sign.signatureLength);

  const signedZomeCall: CallZomeRequestSigned = {
    ...unsignedZomeCallPayload,
    signature,
  };
  return signedZomeCall;
};

export const grantSigningKeyAndSignZomeCall = async (
  admin: AdminWebsocket,
  payload: any
) => {
  const [keyPair, signingKey] = generateSigningKeyPair();
  const capSecret = await grantSigningKey(
    admin,
    payload.cell_id,
    [[payload.zome_name, payload.fn_name]],
    signingKey
  );
  payload = { ...payload, cap_secret: capSecret };
  const signedZomeCall = signZomeCall(capSecret, signingKey, keyPair, payload);
  return signedZomeCall;
};
