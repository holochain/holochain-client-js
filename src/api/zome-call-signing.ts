import { hashZomeCall } from "@holochain/serialization";
import { encode } from "@msgpack/msgpack";
import crypto from "crypto";
import nacl from "tweetnacl";
import { CapSecret } from "../hdk/capabilities.js";
import { AgentPubKey, CellId } from "../types.js";
import { encodeHashToBase64 } from "../utils/base64.js";
import { FunctionName, ZomeName } from "./admin/types.js";
import { AdminWebsocket } from "./admin/websocket.js";
import { CallZomeRequest } from "./app/types.js";
import {
  CallZomeRequestSigned,
  CallZomeRequestUnsigned,
} from "./app/websocket.js";

export interface SigningCredentials {
  capSecret: CapSecret;
  keyPair: nacl.SignKeyPair;
  signingKey: AgentPubKey;
}
export type Nonce256Bit = Uint8Array;

const signingProps: Map<string, SigningCredentials> = new Map();

/**
 * Generate and authorize a new key pair for signing zome calls.
 *
 * @param adminWs - An admin websocket connection to use for granting a
 * capability for signing.
 * @param cellId - The cell id to create the capability grant for.
 * @param functions - Zomes and functions to authorize the signing key for.
 */
export const authorizeSigningCredentials = async (
  adminWs: Pick<AdminWebsocket, "grantZomeCallCapability">,
  cellId: CellId,
  functions: [ZomeName, FunctionName][]
) => {
  const [keyPair, signingKey] = generateSigningKeyPair();
  const capSecret = await grantSigningKey(
    adminWs,
    cellId,
    functions,
    signingKey
  );
  const cellIdBase64 = encodeHashToBase64(cellId[0]).concat(
    encodeHashToBase64(cellId[1])
  );
  signingProps.set(cellIdBase64, { capSecret, keyPair, signingKey });
};

/**
 * Get properties for signing a zome call made to a cell.
 *
 * @param cellId - Cell id to be called.
 * @returns The keys and cap secret required for signing a zome call.
 */
export const getSigningCredentials = (cellId: CellId) => {
  const cellIdB64 = encodeHashToBase64(cellId[0]).concat(
    encodeHashToBase64(cellId[1])
  );
  return signingProps.get(cellIdB64);
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

export const randomCapSecret: () => CapSecret = () => randomByteArray(64);

export const randomNonce: () => Nonce256Bit = () => randomByteArray(32);

export const randomByteArray = (length: number) => {
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
  admin: Pick<AdminWebsocket, "grantZomeCallCapability">,
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

export const signZomeCall = async (request: CallZomeRequest) => {
  const signingCredentialsForCell = getSigningCredentials(request.cell_id);
  if (!signingCredentialsForCell) {
    throw new Error(
      "cannot sign zome call: signing properties have not been set"
    );
  }
  const unsignedZomeCallPayload: CallZomeRequestUnsigned = {
    cap_secret: signingCredentialsForCell.capSecret,
    cell_id: request.cell_id,
    zome_name: request.zome_name,
    fn_name: request.fn_name,
    provenance: signingCredentialsForCell.signingKey,
    payload: encode(request.payload),
    nonce: randomNonce(),
    expires_at: getNonceExpiration(),
  };
  const hashedZomeCall = await hashZomeCall(unsignedZomeCallPayload);
  const signature = nacl
    .sign(hashedZomeCall, signingCredentialsForCell.keyPair.secretKey)
    .subarray(0, nacl.sign.signatureLength);

  const signedZomeCall: CallZomeRequestSigned = {
    ...unsignedZomeCallPayload,
    signature,
  };
  return signedZomeCall;
};
