import { assert, test } from "vitest";
import {
  AdminWebsocket,
  AppWebsocket,
  CallZomeRequest,
  CallZomeRequestSigned,
} from "../../src/index.js";
import {
  createAppInterfaceAndInstallApp,
  createAppWsAndInstallApp,
  withConductor,
} from "./common.js";
import getPort from "get-port";

const TEST_ZOME_NAME = "foo";

const getAdminPort = () => getPort({ port: [30_000, 31_000] });

test("AdminWebsocket connects with options provided by window.__HC_LAUNCHER_ENV__", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore-next-line
    globalThis.window = { Blob };
    globalThis.window.__HC_LAUNCHER_ENV__ = {
      ADMIN_INTERFACE_PORT: adminPort,
    };
    const admin = await AdminWebsocket.connect({
      wsClientOptions: { origin: "client-test-admin" },
    });

    assert.equal(admin.client.url?.href, `ws://localhost:${adminPort}/`);
  })();
});

test("AppWebsocket connects with options provided by window.__HC_LAUNCHER_ENV__", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore-next-line
    globalThis.window = { Blob };

    const { installed_app_id, appPort, appAuthentication } =
      await createAppInterfaceAndInstallApp(adminPort);

    globalThis.window.__HC_LAUNCHER_ENV__ = {
      APP_INTERFACE_PORT: appPort,
      INSTALLED_APP_ID: installed_app_id,
      APP_INTERFACE_TOKEN: appAuthentication.token,
    };
    const appWs = await AppWebsocket.connect({
      wsClientOptions: { origin: "client-test-app" },
    });

    assert.equal(appWs.client.url?.href, `ws://localhost:${appPort}/`);
  })();
});

test("AppWebsocket uses the zome call signer function provided by window.__HC_ZOME_CALL_SIGNER__", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
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

    const { cell_id, app_ws } = await createAppWsAndInstallApp(adminPort);

    const request: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: cell_id[1],
      payload: null,
    };
    try {
      await app_ws.callZome(request, 500);
      // eslint-disable-next-line no-empty
    } catch {}

    assert(signerWasCalled, "__HC_ZOME_CALL_SIGNER__.signZomeCall called");
  })();
});
