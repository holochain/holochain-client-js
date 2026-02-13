import test from "tape";
import {
  AdminWebsocket,
  AppWebsocket,
  CallZomeRequest,
  CallZomeRequestSigned,
} from "../../src/index.js";
import {
  withConductor,
  createAppInterfaceAndInstallApp,
  createAppWsAndInstallApp,
} from "./common.js";

const ADMIN_PORT = 33001;
const TEST_ZOME_NAME = "foo";

test(
  "AdminWebsocket connects with options provided by window.__HC_LAUNCHER_ENV__",
  { timeout: 60_000 },
  withConductor(ADMIN_PORT, async (t) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore-next-line
    globalThis.window = { Blob };
    globalThis.window.__HC_LAUNCHER_ENV__ = {
      ADMIN_INTERFACE_PORT: ADMIN_PORT,
    };
    const admin = await AdminWebsocket.connect({
      wsClientOptions: { origin: "client-test-admin" },
    });

    t.equal(admin.client.url?.href, `ws://localhost:${ADMIN_PORT}/`);
  }),
);

test(
  "AppWebsocket connects with options provided by window.__HC_LAUNCHER_ENV__",
  { timeout: 60_000 },
  withConductor(ADMIN_PORT, async (t) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore-next-line
    globalThis.window = { Blob };

    const { installed_app_id, appPort, appAuthentication } =
      await createAppInterfaceAndInstallApp(ADMIN_PORT);

    globalThis.window.__HC_LAUNCHER_ENV__ = {
      APP_INTERFACE_PORT: appPort,
      INSTALLED_APP_ID: installed_app_id,
      APP_INTERFACE_TOKEN: appAuthentication.token,
    };
    const appWs = await AppWebsocket.connect({
      wsClientOptions: { origin: "client-test-app" },
    });

    t.equal(appWs.client.url?.href, `ws://localhost:${appPort}/`);
  }),
);

test(
  "AppWebsocket uses the zome call signer function provided by window.__HC_ZOME_CALL_SIGNER__",
  { timeout: 60_000 },
  withConductor(ADMIN_PORT, async (t) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore-next-line
    globalThis.window = { Blob };

    let signerWasCalled = false;

    globalThis.window.__HC_ZOME_CALL_SIGNER__ = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      signZomeCall: async (_request: CallZomeRequest) => {
        signerWasCalled = true;

        return {} as CallZomeRequestSigned;
      },
    };

    const { cell_id, client } = await createAppWsAndInstallApp(ADMIN_PORT);

    const request: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: cell_id[1],
      payload: null,
    };
    try {
      await client.callZome(request, 500);
      // eslint-disable-next-line no-empty
    } catch {}

    t.assert(signerWasCalled, "__HC_ZOME_CALL_SIGNER__.signZomeCall called");
  }),
);
