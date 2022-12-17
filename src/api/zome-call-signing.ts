import { CapSecret } from "../hdk/capabilities.js";
import { AgentPubKey, CellId } from "../types.js";
import { FunctionName, ZomeName } from "./admin/types.js";
import { AdminWebsocket } from "./admin/websocket.js";
import { generateSigningKeyPair, grantSigningKey } from "./app/util.js";
import { fromUint8Array } from "js-base64";

const signingProps: Map<
  string,
  {
    capSecret: CapSecret;
    keyPair: nacl.SignKeyPair;
    signingKey: AgentPubKey;
  }
> = new Map();

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
  const cellIdB64 = fromUint8Array(cellId[0]).concat(fromUint8Array(cellId[1]));
  signingProps.set(cellIdB64, { capSecret, keyPair, signingKey });
};

export const getSigningPropsForCell = (cellId: CellId) => {
  const cellIdB64 = fromUint8Array(cellId[0]).concat(fromUint8Array(cellId[1]));
  return signingProps.get(cellIdB64);
};
