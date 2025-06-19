import { AdminWebsocket, AppWebsocket, CellType, Signal } from "./lib/index.js";

const adminWs = await AdminWebsocket.connect({
  url: new URL("ws://127.0.0.1:65000"),
  wsClientOptions: { origin: "my-happ" },
});
const agent_key = await adminWs.generateAgentPubKey();
const role_name = "foo";
const installed_app_id = "test-app";
const appInfo = await adminWs.installApp({
  source: {
    type: "path",
    value: "./test/e2e/fixture/test.happ",
  },
  agent_key,
  installed_app_id,
});
await adminWs.enableApp({ installed_app_id });
if (appInfo.cell_info[role_name][0].type !== CellType.Provisioned) {
  throw new Error(`No cell found under role name ${role_name}`);
}
const { cell_id } = appInfo.cell_info[role_name][0].value;
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

let signalCb;
const signalReceived = new Promise<void>((resolve) => {
  signalCb = (signal: Signal) => {
    console.log("signal received", signal);
    // act on signal
    resolve();
  };
});

appWs.on("signal", signalCb);

// trigger an emit_signal
await appWs.callZome({
  cell_id,
  zome_name: "foo",
  fn_name: "emitter",
  provenance: agent_key,
  payload: null,
});
await signalReceived;

await appWs.client.close();
await adminWs.client.close();
