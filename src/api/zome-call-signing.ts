import { hashZomeCall } from "@holochain/serialization";
import { encode } from "@msgpack/msgpack";
import crypto from "crypto";
import nacl from "tweetnacl";
import {
  CallZomeRequest,
  CallZomeRequestSigned,
  CallZomeRequestUnsigned,
  Nonce256Bit,
} from "../api/app/index.js";
import type { CapSecret } from "../hdk/capabilities.js";
import type { AgentPubKey, CellId } from "../types.js";
import { encodeHashToBase64 } from "../utils/base64.js";
import type { FunctionName, ZomeName } from "./admin/types.js";
import { AdminWebsocket } from "./admin/websocket.js";

export interface SigningCredentials {
  capSecret: CapSecret;
  keyPair: nacl.SignKeyPair;
  signingKey: AgentPubKey;
}

const signingCredentials: Map<string, SigningCredentials> = new Map();

/**
 * Generate signing credentials for signing zome calls.
 *
 * @param adminWs - An admin websocket connection to use for granting a
 * capability for signing.
 * @param cellId - The cell id to create the capability grant for.
 * @param functions - Zomes and functions to authorize the signing key for.
 */
export const authorizeSigningCredentials = async (
  adminWs: AdminWebsocket,
  cellId: CellId,
  functions: [ZomeName, FunctionName][]
) => {
  const cellIdBase64 = encodeHashToBase64(cellId[0]).concat(
    encodeHashToBase64(cellId[1])
  );
  const [keyPair, signingKey] = generateSigningKeyPair();
  const capSecret = await grantSigningKey(
    adminWs,
    cellId,
    functions,
    signingKey
  );
  signingCredentials.set(cellIdBase64, { capSecret, keyPair, signingKey });
};

/**
 * Get properties for signing a zome call to a cell.
 *
 * @param cellId - Cell id to be called.
 * @returns The keys and cap secret required for signing a zome call.
 */
export const getSigningCredentials = (cellId: CellId) => {
  const cellIdB64 = encodeHashToBase64(cellId[0]).concat(
    encodeHashToBase64(cellId[1])
  );
  return signingCredentials.get(cellIdB64);
};

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

export const randomByteArray = (length: number) => {
  if (
    typeof window === "object" &&
    "crypto" in window &&
    "getRandomValues" in window.crypto
  ) {
    return window.crypto.getRandomValues(new Uint8Array(length));
  } else {
    return new Uint8Array(crypto.randomBytes(length));
  }
};

export const getNonceExpiration = () => (Date.now() + 5 * 60 * 1000) * 1000; // 5 mins from now in microseconds

export const signZomeCall = async (
  signingCredentials: SigningCredentials,
  request: CallZomeRequest
) => {
  const unsignedZomeCallPayload: CallZomeRequestUnsigned = {
    cap_secret: signingCredentials.capSecret,
    cell_id: request.cell_id,
    zome_name: request.zome_name,
    fn_name: request.fn_name,
    provenance: signingCredentials.signingKey,
    payload: encode(request.payload),
    nonce: randomNonce(),
    expires_at: getNonceExpiration(),
  };
  const hashedZomeCall = await hashZomeCall(unsignedZomeCallPayload);
  const signature = nacl
    .sign(hashedZomeCall, signingCredentials.keyPair.secretKey)
    .subarray(0, nacl.sign.signatureLength);

  const signedZomeCall: CallZomeRequestSigned = {
    ...unsignedZomeCallPayload,
    signature,
  };
  return signedZomeCall;
};

const grantSigningKey = async (
  admin: AdminWebsocket,
  cellId: CellId,
  functions: Array<[ZomeName, FunctionName]>,
  signingKey: AgentPubKey
): Promise<CapSecret> => {
  const capSecret = randomCapSecret();
  await admin.grantZomeCallCapability({
    cell_id: cellId,
    cap_grant: {
      tag: `signing-key-${encodeHashToBase64(cellId[0])}-${encodeHashToBase64(
        cellId[1]
      )}`,
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
