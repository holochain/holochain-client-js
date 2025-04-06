import test from "tape";
import {
  AdminWebsocket,
  AppWebsocket,
  RoleName,
} from "../../src/index.js";
import {
    withConductor,
    createAppInterfaceAndInstallApp,
    delay,
} from "./common.js";
import { AwaitLauncherEnvironment, HostZomeCallSigner, LauncherEnvironment } from "../../src/environments/launcher.js";

const ADMIN_PORT = 33001;

const ROLE_NAME: RoleName = "foo";
const TEST_ZOME_NAME = "foo";


test(
  "AdminWebsocket connects with options provided by window.__HC_LAUNCHER_ENV__",
  withConductor(ADMIN_PORT, async (t) => {
    // @ts-ignore-next-line
    globalThis.window = { Blob };
    globalThis.window.__HC_LAUNCHER_ENV__ = {
        ADMIN_INTERFACE_PORT: ADMIN_PORT
    };
    const admin = await AdminWebsocket.connect({
        wsClientOptions: { origin: "client-test-admin" },
    });

    t.equal(admin.client.url?.href, `ws://localhost:${ADMIN_PORT}/`);
}));

test(
    "AppWebsocket connects with options provided by window.__HC_LAUNCHER_ENV__",
    withConductor(ADMIN_PORT, async (t) => {
        // @ts-ignore-next-line
        globalThis.window = { Blob };
        
        const { installed_app_id, cell_id, appPort, appAuthentication, admin } = await createAppInterfaceAndInstallApp(ADMIN_PORT);

        globalThis.window.__HC_LAUNCHER_ENV__ = {
          APP_INTERFACE_PORT: appPort,
          INSTALLED_APP_ID: installed_app_id,
          APP_INTERFACE_TOKEN: appAuthentication.token,
        };
        const appWs = await AppWebsocket.connect({
            wsClientOptions: { origin: "client-test-app" },
        });

        await appWs.networkInfo({
            dnas: [cell_id[0]],
        });
    
        t.equal(appWs.client.url?.href, `ws://localhost:${appPort}/`);
}));


test(
    "AdminWebsocket waits for window.__HC_LAUNCHER_ENV__ when window.__HC_AWAIT_LAUNCHER_ENV__ is defined",
    withConductor(ADMIN_PORT, async (t) => {
        // @ts-ignore-next-line
        globalThis.window = { Blob };
        globalThis.window.__HC_AWAIT_LAUNCHER_ENV__ = {
            timeout: 10000
        };

        // Wait 100ms, then set __HC_LAUNCHER_ENV__
        setTimeout(() => {
            globalThis.window.__HC_LAUNCHER_ENV__ = {
                ADMIN_INTERFACE_PORT: ADMIN_PORT
            };
        }, 100);

        // Immediately attempt to connect to AdminWebsocket
        const admin = await AdminWebsocket.connect({
            wsClientOptions: { origin: "client-test-admin" },
        });

        // Wait 200ms
        await delay(200);

        // Assert we have received the __HC_LAUNCHER_ENV__
        t.equal(admin.client.url?.href, `ws://localhost:${ADMIN_PORT}/`);
  }));



  test(
    "AppWebsocket waits for window.__HC_LAUNCHER_ENV__ when window.__HC_AWAIT_LAUNCHER_ENV__ is defined",
    withConductor(ADMIN_PORT, async (t) => {
        // @ts-ignore-next-line
        globalThis.window = { Blob };
    
        const { installed_app_id, appPort, appAuthentication } = await createAppInterfaceAndInstallApp(ADMIN_PORT);

        globalThis.window.__HC_AWAIT_LAUNCHER_ENV__ = {
            timeout: 10000
        };
        
        // Wait 100ms, then set __HC_LAUNCHER_ENV__
        setTimeout(() => {
            globalThis.window.__HC_LAUNCHER_ENV__ = {
                APP_INTERFACE_PORT: appPort,
                INSTALLED_APP_ID: installed_app_id,
                APP_INTERFACE_TOKEN: appAuthentication.token,
            };
        }, 100);

        // Immediately attempt to connect to AppWebsocket
        const appWs = await AppWebsocket.connect({
            wsClientOptions: { origin: "client-test-app" },
        });

        // Wait 200ms
        await delay(200);

        // Assert we have received the __HC_LAUNCHER_ENV__
        t.equal(appWs.client.url?.href, `ws://localhost:${appPort}/`);
}));


test(
    "AppWebsocket does not wait for window.__HC_AWAIT_LAUNCHER_ENV__ past timeout",
    withConductor(ADMIN_PORT, async (t) => {
        // @ts-ignore-next-line
        globalThis.window = { Blob };
        
        const { installed_app_id, appPort, appAuthentication, admin } = await createAppInterfaceAndInstallApp(ADMIN_PORT);
        
        globalThis.window.__HC_AWAIT_LAUNCHER_ENV__ = {
            interval: 10,
            timeout: 100
        };


        setTimeout(() => {
            globalThis.window.__HC_LAUNCHER_ENV__ = {
                APP_INTERFACE_PORT: appPort,
                INSTALLED_APP_ID: installed_app_id,
                APP_INTERFACE_TOKEN: appAuthentication.token,
            };
        }, 200)

          try {
            await AppWebsocket.connect({
                wsClientOptions: { origin: "client-test-app" },
            });
            t.fail();
          } catch(e) {
            t.pass();
          }
    }));
