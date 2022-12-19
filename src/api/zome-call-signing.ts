import nacl from "tweetnacl";
import { CapSecret } from "../hdk/capabilities.js";
import { AgentPubKey, CellId } from "../types.js";
import { encodeHashToBase64 } from "../utils/base64.js";
import { FunctionName, ZomeName } from "./admin/types.js";
import { AdminWebsocket } from "./admin/websocket.js";
import { generateSigningKeyPair, grantSigningKey } from "./app/util.js";

const signingProps: Map<
  string,
  {
    capSecret: CapSecret;
    keyPair: nacl.SignKeyPair;
    signingKey: AgentPubKey;
  }
> = new Map();

/**
 * Generate and authorize a new key pair for signing zome calls.
 *
 * @param adminWs - An admin websocket connection to use for granting a
 * capability for signing.
 * @param cellId - The cell id to create the capability grant for.
 * @param functions - Zomes and functions to authorize the signing key for.
 */
export const authorizeNewSigningKeyPair = async (
  adminWs: AdminWebsocket,
  cellId: CellId,
  functions: [[ZomeName, FunctionName]]
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
 * Get properties for signing a zome call to a cell.
 *
 * @param cellId - Cell id to be called.
 * @returns The keys and cap secret required for signing a zome call.
 */
export const getSigningPropsForCell = (cellId: CellId) => {
  const cellIdB64 = encodeHashToBase64(cellId[0]).concat(
    encodeHashToBase64(cellId[1])
  );
  return signingProps.get(cellIdB64);
};
