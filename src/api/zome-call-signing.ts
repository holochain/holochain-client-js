import { CapSecret } from "../hdk/capabilities.js";
import { AgentPubKey, CellId } from "../types.js";
import { FunctionName, ZomeName } from "./admin/types.js";
import { AdminWebsocket } from "./admin/websocket.js";
import { generateSigningKeyPair, grantSigningKey } from "./app/util.js";

export const signingProps: Map<
  CellId,
  {
    capSecret: CapSecret;
    keyPair: nacl.SignKeyPair;
    signingKey: AgentPubKey;
  }
> = new Map();

export const authorizeNewKeyPair = async (
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
  signingProps.set(cellId, { capSecret, keyPair, signingKey });
};
