import {
  AdminWebsocket,
  AppWebsocket,
  CellType,
  type ActionHash,
  type CallZomeRequest,
} from "./lib/index.js";

const adminWs = await AdminWebsocket.connect({
  url: new URL("ws://127.0.0.1:65000"),
  wsClientOptions: { origin: "my-happ" },
});
const agent_key = await adminWs.generateAgentPubKey();
const role_name = "foo";
const installed_app_id = "test-app";
const appInfo = await adminWs.installApp({
  agent_key,
  path: "./test/e2e/fixture/test.happ",
  installed_app_id,
  membrane_proofs: {},
});
await adminWs.enableApp({ installed_app_id });
if (!(CellType.Provisioned in appInfo.cell_info[role_name][0])) {
  throw new Error(`No cell found under role name ${role_name}`);
}
const { cell_id } = appInfo.cell_info[role_name][0][CellType.Provisioned];
await adminWs.authorizeSigningCredentials(cell_id);
await adminWs.attachAppInterface({ port: 65001, allowed_origins: "my-happ" });
const issuedToken = await adminWs.issueAppAuthenticationToken({
  installed_app_id,
});
const appWs = await AppWebsocket.connect({
  url: new URL("ws://127.0.0.1:65001"),
  token: issuedToken.token,
  wsClientOptions: { origin: "my-happ" },
});

const zomeCallPayload: CallZomeRequest = {
  cell_id,
  zome_name: "foo",
  fn_name: "foo",
  provenance: agent_key,
  payload: null,
};

const response: ActionHash = await appWs.callZome(zomeCallPayload, 30000);
console.log("zome call response is", response);

await appWs.client.close();
await adminWs.client.close();
