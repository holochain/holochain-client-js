import { decode, encode } from "@msgpack/msgpack";
import fs from "node:fs";
import { test, assert } from "vitest";
import yaml from "js-yaml";
import zlib from "zlib";
import {
  ActionHash,
  ActionType,
  AdminWebsocket,
  AppEntryDef,
  AppStatusFilter,
  AppWebsocket,
  CallZomeRequest,
  CellProvisioningStrategy,
  CreateCloneCellRequest,
  DumpStateResponse,
  FullStateDump,
  HolochainError,
  Link,
  RegisterAgentActivity,
  RoleName,
  generateSigningKeyPair,
  Signal,
  isSameCell,
  getSigningCredentials,
  randomNonce,
  getNonceExpiration,
  ProvisionedCell,
  CellType,
  AppBundle,
  fakeDnaHash,
  encodeHashToBase64,
  CloneIdHelper,
  SignalType,
  Record,
  AppStatus,
} from "../../src/index.js";
import {
  FIXTURE_PATH,
  cleanSandboxConductors,
  createAppWsAndInstallApp,
  installAppAndDna,
  launch,
  makeCoordinatorZomeBundle,
  retryUntilTimeout,
  runLocalServices,
  stopConductor,
  stopLocalServices,
  withConductor,
} from "./common.js";
import getPort from "get-port";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fakeAgentPubKey = () =>
  Buffer.from(
    [0x84, 0x20, 0x24].concat(
      "000000000000000000000000000000000000"
        .split("")
        .map((x) => parseInt(x, 10)),
    ),
  );

const getAdminPort = () => getPort({ port: [30_000, 31_000] });
const getAdminWsUrl = (port: number) => new URL(`ws://localhost:${port}`);

const ROLE_NAME: RoleName = "foo";
const TEST_ZOME_NAME = "foo";

test("admin smoke test: installApp + uninstallApp", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });

    const agent_key = await admin.generateAgentPubKey();
    assert.ok(agent_key, "agent key generated");

    const installedApp = await admin.installApp({
      source: {
        type: "path",
        value: `${FIXTURE_PATH}/test.happ`,
      },
      installed_app_id,
      agent_key,
    });
    const status: AppStatus = installedApp.status;
    assert.deepEqual(
      status,
      { type: "disabled", value: { type: "never_started" } },
      "app installed",
    );

    const runningApps = await admin.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    assert.equal(runningApps.length, 0, "no running apps");

    let allAppsInfo = await admin.listApps({});
    assert.equal(allAppsInfo.length, 1, "all apps listed");

    const disabledAppsInfo = await admin.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    assert.equal(disabledAppsInfo.length, 1, "1 disabled app");
    assert.equal(
      disabledAppsInfo[0].cell_info[ROLE_NAME].length,
      1,
      "expected cell in disabled app info",
    );
    assert.deepEqual(
      disabledAppsInfo[0].status,
      { type: "disabled", value: { type: "never_started" } },
      "disabled app never started",
    );

    const app = await admin.enableApp({ installed_app_id });
    assert.deepEqual(app.status, { type: "enabled" });
    assert.ok(ROLE_NAME in app.cell_info);
    assert.ok(Array.isArray(app.cell_info[ROLE_NAME]));
    assert.equal(app.installed_app_id, installed_app_id);

    const activeApps2 = await admin.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    assert.equal(activeApps2.length, 1);
    assert.equal(activeApps2[0].installed_app_id, installed_app_id);

    const runningAppsInfo2 = await admin.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    const disabledAppsInfo2 = await admin.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    const pausedAppsInfo2 = await admin.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    assert.equal(pausedAppsInfo2.length, 0);
    assert.equal(disabledAppsInfo2.length, 0);
    assert.equal(runningAppsInfo2.length, 1);
    assert.equal(runningAppsInfo2[0].cell_info[ROLE_NAME].length, 1);
    assert.deepEqual(runningAppsInfo2[0].status, { type: "enabled" });

    await admin.attachAppInterface({
      port: 0,
      allowed_origins: "client-test-app",
    });
    await admin.disableApp({ installed_app_id });

    const runningAppsInfo3 = await admin.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    const disabledAppsInfo3 = await admin.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    assert.equal(runningAppsInfo3.length, 0);
    assert.equal(disabledAppsInfo3.length, 1);
    assert.deepEqual(disabledAppsInfo3[0].status, {
      type: "disabled",
      value: { type: "user" },
    });

    const dnas = await admin.listDnas();
    assert.equal(dnas.length, 1);

    const activeApps3 = await admin.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    assert.equal(activeApps3.length, 0);
    // NB: missing dumpState because it requires a valid cell_id

    await admin.uninstallApp({ installed_app_id });
    allAppsInfo = await admin.listApps({});
    assert.equal(allAppsInfo.length, 0);
  })();
});

test("admin smoke test: installBundle", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });

    const agent_key = await admin.generateAgentPubKey();
    assert.ok(agent_key);

    const path = `${FIXTURE_PATH}/test.happ`;
    const installedApp = await admin.installApp({
      source: {
        type: "path",
        value: path,
      },
      agent_key,
      installed_app_id,
    });
    assert.ok(installedApp);
    assert.deepEqual(installedApp.status, {
      type: "disabled",
      value: { type: "never_started" },
    });

    const runningApps1 = await admin.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    assert.equal(runningApps1.length, 0);

    const enabledAppInfo = await admin.enableApp({ installed_app_id });
    assert.deepEqual(enabledAppInfo.status, { type: "enabled" });
    assert.equal(enabledAppInfo.installed_app_id, installed_app_id);

    const runningApps2 = await admin.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    assert.equal(runningApps2.length, 1);
    assert.equal(runningApps2[0].installed_app_id, installed_app_id);

    const cellIds = await admin.listCellIds();
    assert.equal(cellIds.length, 1);
    assert(installedApp.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    assert.isTrue(
      cellIds.some((cellId) =>
        isSameCell(
          cellId,
          (installedApp.cell_info[ROLE_NAME][0].value as ProvisionedCell)
            .cell_id,
        ),
      ),
    );

    await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    await admin.disableApp({ installed_app_id });

    const dnas = await admin.listDnas();
    assert.equal(dnas.length, 1);

    const activeApps3 = await admin.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    assert.equal(activeApps3.length, 0);
  })();
});

test("can call a zome function and then deactivate", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { installed_app_id, cell_id, client, admin } =
      await installAppAndDna(adminPort);
    let info = await client.appInfo(1000);
    assert(info, "got app info");
    assert(
      info.cell_info[ROLE_NAME][0].type === CellType.Provisioned,
      "got expected cell",
    );
    assert.deepEqual(
      info.cell_info[ROLE_NAME][0].value.cell_id,
      cell_id,
      "got correct cell id",
    );
    assert.ok(ROLE_NAME in info.cell_info, "role name correct");
    assert.deepEqual(info.status, { type: "enabled" }, "status is running");

    await admin.authorizeSigningCredentials(cell_id);

    const appEntryDef: AppEntryDef = {
      entry_index: 0,
      zome_index: 0,
      visibility: "Private",
    };
    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "echo_app_entry_def",
      provenance: cell_id[1],
      payload: appEntryDef,
    };

    const response = await client.callZome(zomeCallPayload, 30000);
    assert.equal(response, null, "app entry def deserializes correctly");

    await admin.disableApp({ installed_app_id });
    info = await client.appInfo(1000);
    assert(info);
    assert.deepEqual(
      info.status,
      { type: "disabled", value: { type: "user" } },
      "disabled reason user",
    );
  })();
});

test("can call a zome function with different sets of params", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { cell_id, client, admin } = await installAppAndDna(adminPort);
    await admin.authorizeSigningCredentials(cell_id);

    const request: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: cell_id[1],
      payload: null,
    };
    let response = await client.callZome(request, 30000);
    assert.equal(response, "foo", "zome can be called with all parameters");

    const cap_secret = getSigningCredentials(cell_id)?.capSecret;
    assert(cap_secret);

    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: cell_id[1],
      payload: null,
      cap_secret,
      nonce: await randomNonce(),
      expires_at: getNonceExpiration(),
    };

    response = await client.callZome(zomeCallPayload, 30000);
    assert.equal(response, "foo", "zome can be called with all parameters");
  })();
});

test("can call attachAppInterface without specific port", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { admin, installed_app_id } = await installAppAndDna(adminPort);
    const { port } = await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    assert.isTrue(typeof port === "number", "returned a valid app port");
    const issued = await admin.issueAppAuthenticationToken({
      installed_app_id,
    });
    await AppWebsocket.connect({
      url: new URL(`ws://localhost:${port}`),
      wsClientOptions: { origin: "client-test-app" },
      token: issued.token,
    });
  })();
});

test("invalid app authentication token fails", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { admin } = await installAppAndDna(adminPort);
    const { port } = await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    try {
      await AppWebsocket.connect({
        url: new URL(`ws://localhost:${port}`),
        wsClientOptions: { origin: "client-test-app" },
        token: [0],
      });
      assert.fail("could connect with invalid authentication token");
    } catch (error) {
      assert.isTrue(error instanceof HolochainError);
      assert(error instanceof HolochainError);
      assert.equal(
        error.name,
        "InvalidTokenError",
        "expected InvalidTokenError",
      );
    }
  })();
});

test("app websocket connection from allowed origin is established", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { admin, installed_app_id } = await installAppAndDna(adminPort);
    const allowedOrigin = "client-test-app";
    const { port } = await admin.attachAppInterface({
      allowed_origins: allowedOrigin,
    });
    const issued = await admin.issueAppAuthenticationToken({
      installed_app_id,
    });
    try {
      await AppWebsocket.connect({
        url: new URL(`ws://localhost:${port}`),
        wsClientOptions: { origin: allowedOrigin },
        token: issued.token,
      });
    } catch {
      assert.fail("app websocket connection should have been established");
    }
  })();
});

test("app websocket connection from disallowed origin is rejected", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { admin, installed_app_id } = await installAppAndDna(adminPort);
    const { port } = await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    const issued = await admin.issueAppAuthenticationToken({
      installed_app_id,
    });
    try {
      await AppWebsocket.connect({
        url: new URL(`ws://localhost:${port}`),
        wsClientOptions: { origin: "disallowed_origin" },
        token: issued.token,
      });
      assert.fail("app websocket connection should have failed");
    } catch (error) {
      assert.isTrue(
        error instanceof HolochainError,
        "expected a HolochainError",
      );
    }
  })();
});

test("client errors are HolochainErrors", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { cell_id, client, admin } = await installAppAndDna(adminPort);
    const info = await client.appInfo(1000);
    assert(info);
    assert(info.cell_info[ROLE_NAME][0].type === CellType.Provisioned);

    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "fn_that_does_not_exist",
      provenance: cell_id[1],
      payload: null,
    };

    await admin.authorizeSigningCredentials(cell_id);

    try {
      await client.callZome(zomeCallPayload);
      assert.fail("This zome call should have thrown an error.");
    } catch (error) {
      assert.ok(
        error instanceof HolochainError,
        "error is an instance of HolochainError",
      );
      assert(error instanceof HolochainError);
      assert.equal(error.name, "internal_error", "error has correct name");
    }
  })();
});

test("can install app with roles_settings", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin.generateAgentPubKey();

    const progenitorKey = Uint8Array.from(fakeAgentPubKey());

    await admin.installApp({
      installed_app_id,
      agent_key: agent,
      source: {
        type: "path",
        value: `${FIXTURE_PATH}/test.happ`,
      },
      roles_settings: {
        foo: {
          type: "provisioned",
          value: {
            membrane_proof: new Uint8Array(6),
            modifiers: {
              network_seed: "hello",
              properties: yaml.dump({ progenitor: progenitorKey }),
            },
          },
        },
      },
    });

    const apps = await admin.listApps({});
    const appInfo = apps[0];
    const provisionedCell = appInfo.cell_info["foo"][0]
      .value as ProvisionedCell;
    assert.equal(provisionedCell.dna_modifiers.network_seed, "hello");
    assert.deepEqual(
      yaml.load(decode(provisionedCell.dna_modifiers.properties) as string),
      { progenitor: progenitorKey },
    );
  })();
});

test("memproofs can be provided after app installation", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const role_name = "foo";
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin.generateAgentPubKey();

    const zippedDnaBundle = fs.readFileSync("test/e2e/fixture/test.dna");

    const appBundle: AppBundle = {
      manifest: {
        manifest_version: "0",
        name: "app",
        roles: [
          {
            name: role_name,
            provisioning: {
              strategy: CellProvisioningStrategy.Create,
              deferred: false,
            },
            dna: {
              path: "dna_1",
              modifiers: { network_seed: "some_seed" },
            },
          },
        ],
        allow_deferred_memproofs: true,
      },
      resources: {
        dna_1: zippedDnaBundle,
      },
    };

    const zippedAppBundle = zlib.gzipSync(encode(appBundle));

    await admin.installApp({
      installed_app_id,
      agent_key: agent,
      source: {
        type: "bytes",
        value: zippedAppBundle,
      },
    });

    const { port: appPort } = await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    const issued = await admin.issueAppAuthenticationToken({
      installed_app_id,
    });
    const client = await AppWebsocket.connect({
      url: new URL(`ws://localhost:${appPort}`),
      wsClientOptions: { origin: "client-test-app" },
      token: issued.token,
    });

    let appInfo = await client.appInfo();
    assert.deepEqual(
      appInfo.status,
      { type: "awaiting_memproofs" },
      "app is not in status awaiting_memproofs",
    );

    try {
      await client.enableApp();
      assert.fail("enabling app should fail while memproofs not provided");
    } catch (error) {
      assert(error instanceof Error);
      assert.equal(
        error.message,
        "Other: app not in correct state to enable",
        "enabling app fails while memproofs not provided",
      );
    }

    const response = await client.provideMemproofs({});
    assert.equal(response, undefined, "memproofs provided successfully");

    appInfo = await client.appInfo();
    assert.deepEqual(
      appInfo.status,
      {
        type: "disabled",
        value: { type: "not_started_after_providing_memproofs" },
      },
      "app is disabled after providing memproofs",
    );

    await client.enableApp();
    appInfo = await client.appInfo();
    assert.deepEqual(appInfo.status, { type: "enabled" }, "app is running");
  })();
});

test("generated signing key has same location bytes as original agent pub key", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const admin = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin.generateAgentPubKey();
    const [, signingKey] = await generateSigningKeyPair(agent);
    assert.deepEqual(
      signingKey.subarray(35),
      Uint8Array.from(agent.subarray(35)),
    );
  })();
});

test("install app from bytes", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const role_name = "foo";
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin.generateAgentPubKey();

    const appBundleBytes = fs.readFileSync(`${FIXTURE_PATH}/test.happ`);

    const app = await admin.installApp({
      installed_app_id,
      agent_key: agent,
      source: {
        type: "bytes",
        value: appBundleBytes,
      },
    });
    await admin.enableApp({ installed_app_id });
    const { port: appPort } = await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    const issued = await admin.issueAppAuthenticationToken({
      installed_app_id,
    });
    const client = await AppWebsocket.connect({
      url: new URL(`ws://localhost:${appPort}`),
      wsClientOptions: { origin: "client-test-app" },
      token: issued.token,
    });

    assert(app.cell_info[role_name][0].type === CellType.Provisioned);
    const cell_id = app.cell_info[role_name][0].value.cell_id;

    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: agent,
      payload: null,
    };

    await admin.authorizeSigningCredentials(cell_id);

    const response = await client.callZome(zomeCallPayload, 30000);
    assert.equal(response, "foo", "zome call succeeds");
  })();
});

test("stateDump", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { cell_id, client, admin } = await installAppAndDna(adminPort);
    const info = await client.appInfo();
    assert(info);
    assert(info.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    assert.deepEqual(info.cell_info[ROLE_NAME][0].value.cell_id, cell_id);
    assert.ok(ROLE_NAME in info.cell_info);
    assert.deepEqual(info.status, { type: "enabled" });
    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };

    await admin.authorizeSigningCredentials(cell_id);

    const response = await client.callZome(zomeCallPayload);
    assert.equal(response, "foo");

    const state: DumpStateResponse = await admin.dumpState({
      cell_id: (info.cell_info[ROLE_NAME][0].value as ProvisionedCell).cell_id,
    });
    assert.equal(state[0].source_chain_dump.records.length, 5);
    assert.equal(state[0].source_chain_dump.records[0].action.type, "Dna");
  })();
});

test("fullStateDump with ChainOps", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { cell_id, admin } = await installAppAndDna(adminPort);
    const state: FullStateDump = await admin.dumpFullState({
      cell_id,
    });
    for (const dhtOp of state.integration_dump.integrated) {
      assert.isTrue("ChainOp" in dhtOp, "dht op is a chain op");
    }
  })();
});

test("can receive a signal using event handler", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { admin, cell_id, client } = await installAppAndDna(adminPort);
    let resolveSignalPromise: (value?: unknown) => void | undefined;
    const signalReceivedPromise = new Promise(
      (resolve) => (resolveSignalPromise = resolve),
    );
    const signalCb = (signal: Signal) => {
      assert(signal.type === SignalType.App);
      assert.deepEqual(signal.value, {
        cell_id,
        zome_name: TEST_ZOME_NAME,
        payload: "i am a signal",
      });
      resolveSignalPromise();
    };
    await admin.authorizeSigningCredentials(cell_id);

    client.on("signal", signalCb);

    // trigger an emit_signal
    await client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "emitter",
      provenance: fakeAgentPubKey(),
      payload: null,
    });
    await signalReceivedPromise;
  })();
});

// test without conductor
test("error is catchable when holochain socket is unavailable", async () => {
  const adminWsUrl = getAdminWsUrl(await getAdminPort());
  try {
    await AdminWebsocket.connect({ url: adminWsUrl });
    assert.fail("websocket connection should have failed");
  } catch (e) {
    assert.isTrue(e instanceof HolochainError, "expected a HolochainError");
  }

  try {
    await AppWebsocket.connect({ url: adminWsUrl });
    assert.fail("websocket connection should have failed");
  } catch (e) {
    assert.isTrue(e instanceof HolochainError, "expected a HolochainError");
  }
});

test("zome call timeout can be overridden", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { client, admin, cell_id } = await installAppAndDna(adminPort);
    await admin.authorizeSigningCredentials(cell_id);
    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "waste_some_time",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    try {
      await client.callZome(zomeCallPayload, 1);
      assert.fail("zome call did not time out");
    } catch {
      assert("zome call timed out");
    }
  })();
});

test("can inject agents", async () => {
  const localServices = await runLocalServices();
  const adminPort = await getAdminPort();
  const conductor = await launch(
    adminPort,
    localServices.bootstrapServerUrl,
    localServices.signalingServerUrl,
  );
  const installed_app_id = "app";
  const admin1 = await AdminWebsocket.connect({
    url: getAdminWsUrl(adminPort),
    wsClientOptions: { origin: "client-test-admin" },
  });

  // There shouldn't be any agent infos yet.
  let agentInfos1 = await admin1.agentInfo({ dna_hashes: null });
  assert.isTrue(agentInfos1.length === 0, "0 agent infos");

  const agent1 = await admin1.generateAgentPubKey();
  const result = await admin1.installApp({
    source: {
      type: "path",
      value: `${FIXTURE_PATH}/test.happ`,
    },
    installed_app_id,
    agent_key: agent1,
  });
  assert(result.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
  const app1_cell = result.cell_info[ROLE_NAME][0].value.cell_id;
  const activeApp1Info = await admin1.enableApp({ installed_app_id }, 1000);
  assert.deepEqual(
    activeApp1Info.status,
    { type: "enabled" },
    "app status running",
  );
  assert.equal(
    activeApp1Info.installed_app_id,
    installed_app_id,
    "installed app id correct",
  );

  await retryUntilTimeout(
    async () => {
      const agentInfos = await admin1.agentInfo({ dna_hashes: null });
      return agentInfos.length;
    },
    0,
    "waiting for agent info in peer store",
    500,
    15000,
  );

  // There should be one agent info now.
  agentInfos1 = await admin1.agentInfo({ dna_hashes: null });
  assert.equal(
    agentInfos1.length,
    1,
    `expected 1 agent info, got ${agentInfos1.length}`,
  );

  // Now confirm that we can ask for agents in just one DNA.
  const dnaAgentInfos = await admin1.agentInfo({
    dna_hashes: [app1_cell[0]],
  });
  assert.deepEqual(
    dnaAgentInfos,
    agentInfos1,
    "DNA agent infos match app agent infos",
  );

  await stopLocalServices(localServices.servicesProcess);
  await stopConductor(conductor);
  await cleanSandboxConductors();
});

test("can query peer meta info over admin and app websocket", async () => {
  const localServices = await runLocalServices();
  const adminPort1 = await getAdminPort();
  const conductor1 = await launch(
    adminPort1,
    localServices.bootstrapServerUrl,
    localServices.signalingServerUrl,
  );
  const {
    cell_id: cell_id1,
    client: appClient1,
    admin: admin1,
  } = await createAppWsAndInstallApp(adminPort1);

  await admin1.authorizeSigningCredentials(cell_id1);

  // Retrieve the peer URL of the agent
  await retryUntilTimeout(
    async () => {
      const agentInfos = await admin1.agentInfo({ dna_hashes: null });
      return agentInfos.length;
    },
    0,
    "agent infos didn't make it to the peer store",
    500,
    15000,
  );
  const agentInfos1 = await admin1.agentInfo({ dna_hashes: null });
  console.debug("agent infos", agentInfos1);
  const agentInfo1 = JSON.parse(agentInfos1[0]).agentInfo;
  const agentUrl1 = JSON.parse(agentInfo1).url;
  console.log("agentUrl1: ", agentUrl1);

  // Start a second conductor and install the same app
  const adminPort2 = await getAdminPort();
  const conductor2 = await launch(
    adminPort2,
    localServices.bootstrapServerUrl,
    localServices.signalingServerUrl,
  );

  const {
    cell_id: cell_id2,
    client: appClient2,
    admin: admin2,
  } = await createAppWsAndInstallApp(adminPort2);

  await admin2.authorizeSigningCredentials(cell_id2);

  // Now create an entry with agent 1 to get some gossip flowing
  const acionHash = await appClient1.callZome({
    cell_id: cell_id1,
    provenance: cell_id1[1],
    zome_name: TEST_ZOME_NAME,
    fn_name: "create_an_entry",
    payload: null,
  });

  // Wait until the second agent can get it to make sure that they
  // have exchanged peer info
  await retryUntilTimeout<Record>(
    () =>
      appClient2.callZome({
        cell_id: cell_id2,
        provenance: cell_id2[1],
        zome_name: TEST_ZOME_NAME,
        fn_name: "get_an_entry",
        payload: acionHash,
      }),
    null,
    "agent 2 wasn't able to get the entry of agent 1",
    200,
    20_000,
  );

  // Now have agent 2 get peer meta info for agent 1 via the admin websocket
  const peerMetaInfos = await admin2.peerMetaInfo({ url: agentUrl1 });

  // Check that it contains gossip meta info
  const metaInfosForDna = peerMetaInfos[encodeHashToBase64(cell_id2[0])];
  assert(metaInfosForDna);
  assert(metaInfosForDna["gossip:completed_rounds"].meta_value);
  assert(metaInfosForDna["gossip:completed_rounds"].expires_at);
  assert(metaInfosForDna["gossip:last_timestamp"].meta_value);
  assert(metaInfosForDna["gossip:last_timestamp"].expires_at);

  // Now have agent 2 get peer meta info for agent 1 via the app websocket
  const peerMetaInfosApp = await appClient2.peerMetaInfo({ url: agentUrl1 });

  // Check that it contains gossip meta info
  const metaInfosForDnaApp = peerMetaInfosApp[encodeHashToBase64(cell_id2[0])];
  assert(metaInfosForDnaApp);
  assert(metaInfosForDnaApp["gossip:completed_rounds"].meta_value);
  assert(metaInfosForDnaApp["gossip:completed_rounds"].expires_at);
  assert(metaInfosForDnaApp["gossip:last_timestamp"].meta_value);
  assert(metaInfosForDnaApp["gossip:last_timestamp"].expires_at);

  await stopLocalServices(localServices.servicesProcess);
  await stopConductor(conductor1);
  await stopConductor(conductor2);
  await cleanSandboxConductors();
});

test("can query agents over app ws", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { client, admin, cell_id } = await installAppAndDna(adminPort);
    await admin.authorizeSigningCredentials(cell_id);

    await retryUntilTimeout(
      async () => {
        const agentInfos = await client.agentInfo({ dna_hashes: null });
        return agentInfos.length;
      },
      0,
      "agent infos didn't make it to the peer store",
      500,
      15_000,
    );

    // There should be one agent info.
    const agentInfos = await client.agentInfo({ dna_hashes: null });
    assert.equal(
      agentInfos.length,
      1,
      `expected 1 agent info bug got ${agentInfos.length}`,
    );

    try {
      await client.agentInfo({
        dna_hashes: [await fakeDnaHash()],
      });
      assert.fail("querying for non-existing space should fail");
    } catch {
      assert("querying for non-existing space should fail");
    }

    const appInfo = await client.appInfo();
    const cell = appInfo.cell_info[ROLE_NAME][0];
    assert(cell.type === CellType.Provisioned);
    const dnaHash = cell.value.cell_id[0];
    const agentInfosForDna = await client.agentInfo({
      dna_hashes: [dnaHash],
    });
    assert.isTrue(
      agentInfosForDna.length === 1,
      "number of agent infos for app's DNA is 1",
    );
    assert.deepEqual(agentInfos, agentInfosForDna);
  })();
});

test("create link", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { cell_id, client, admin } = await installAppAndDna(adminPort);
    await admin.authorizeSigningCredentials(cell_id);

    const tag = "test_tag";
    const link: Link = await client.callZome({
      cell_id,
      provenance: cell_id[1],
      zome_name: TEST_ZOME_NAME,
      fn_name: "create_and_get_link",
      payload: Array.from(Buffer.from(tag)),
    });

    assert.deepEqual(link.author, cell_id[1], "link author is correct");
    assert.deepEqual(
      Array.from(link.create_link_hash.subarray(0, 3)),
      [132, 41, 36],
      "create link hash is valid",
    );
    assert.deepEqual(link.link_type, 0, "link type is correct");
    assert.deepEqual(link.zome_index, 0, "zome index is correct");
    assert.ok("BYTES_PER_ELEMENT" in link.tag, "tag is a byte array");
    assert.deepEqual(link.tag.toString(), tag, "tag is correct");
  })();
});

test("create and delete link", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { cell_id, client, admin } = await installAppAndDna(adminPort);
    await admin.authorizeSigningCredentials(cell_id);

    const linkHash: ActionHash = await client.callZome({
      cell_id,
      provenance: cell_id[1],
      zome_name: TEST_ZOME_NAME,
      fn_name: "create_and_delete_link",
      payload: null,
    });
    const activity: RegisterAgentActivity[] = await client.callZome({
      cell_id,
      provenance: cell_id[1],
      zome_name: TEST_ZOME_NAME,
      fn_name: "get_agent_activity",
      payload: linkHash,
    });
    const lastAction = activity[0];
    assert.equal(
      lastAction.action.hashed.content.type,
      ActionType.DeleteLink,
      "last action is DeleteLink",
    );
    const secondLastAction = activity[1];
    assert.equal(
      secondLastAction.action.hashed.content.type,
      ActionType.CreateLink,
      "second last action is CreateLink",
    );
    assert(
      secondLastAction.action.hashed.content.type === ActionType.CreateLink,
    );
    assert.equal(
      secondLastAction.action.hashed.content.link_type,
      0,
      "link type is 0",
    );
  })();
});

test("admin smoke test: listAppInterfaces + attachAppInterface", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const admin = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });

    let interfaces = await admin.listAppInterfaces();
    assert.equal(interfaces.length, 0);

    await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });

    interfaces = await admin.listAppInterfaces();
    assert.equal(interfaces.length, 1);
    assert.isTrue(interfaces[0].port > 0);
    assert.equal(interfaces[0].allowed_origins, "client-test-app");
    assert.equal(interfaces[0].installed_app_id, null);
  })();
});

test("can use some of the defined js bindings", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { installed_app_id, cell_id, client, admin } =
      await installAppAndDna(adminPort);
    let info = await client.appInfo(1000);
    assert(info);
    assert(info.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    assert.deepEqual(info.cell_info[ROLE_NAME][0].value.cell_id, cell_id);
    assert.ok(ROLE_NAME in info.cell_info);
    assert.deepEqual(info.status, { type: "enabled" });
    await admin.authorizeSigningCredentials(cell_id);
    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    const response = await client.callZome(zomeCallPayload, 30000);
    assert.equal(response, "foo");

    await admin.disableApp({ installed_app_id });
    info = await client.appInfo(1000);
    assert(info);
    assert.deepEqual(info.status, {
      type: "disabled",
      value: { type: "user" },
    });
  })();
});

test("admin smoke test: install 2 hApp bundles with different network seeds", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const admin = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent_key = await admin.generateAgentPubKey();

    const installedApp1 = await admin.installApp({
      source: {
        type: "path",
        value: `${FIXTURE_PATH}/test.happ`,
      },
      agent_key,
      installed_app_id: "test-app1",
      network_seed: "1",
    });
    const installedApp2 = await admin.installApp({
      source: {
        type: "path",
        value: `${FIXTURE_PATH}/test.happ`,
      },
      agent_key,
      installed_app_id: "test-app2",
      network_seed: "2",
    });

    assert(installedApp1.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    assert(installedApp2.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    assert.notDeepEqual(
      installedApp1.cell_info[ROLE_NAME][0].value.cell_id[0],
      installedApp2.cell_info[ROLE_NAME][0].value.cell_id[0],
    );
  })();
});

test("can create a callable clone cell", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { client, admin } = await installAppAndDna(adminPort);
    const appInfo = await client.appInfo();
    assert(appInfo);

    const createCloneCellParams: CreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await client.createCloneCell(createCloneCellParams);

    const expectedCloneId = new CloneIdHelper(ROLE_NAME, 0).toString();
    assert.equal(cloneCell.clone_id, expectedCloneId, "correct clone id");
    assert(appInfo.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    assert.deepEqual(
      cloneCell.cell_id[1],
      appInfo.cell_info[ROLE_NAME][0].value.cell_id[1],
      "clone cell agent key matches base cell agent key",
    );
    const zomeCallPayload: CallZomeRequest = {
      cell_id: cloneCell.cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    await admin.authorizeSigningCredentials(cloneCell.cell_id);
    const response = await client.callZome(zomeCallPayload);
    assert.equal(
      response,
      "foo",
      "clone cell can be called with same zome call as base cell",
    );
  })();
});

test("can disable a clone cell", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { client, admin } = await installAppAndDna(adminPort);
    const createCloneCellParams: CreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await client.createCloneCell(createCloneCellParams);

    await admin.authorizeSigningCredentials(cloneCell.cell_id);

    await client.disableCloneCell({
      clone_cell_id: {
        type: "dna_hash",
        value: cloneCell.cell_id[0],
      },
    });

    const appInfo = await client.appInfo();
    assert(appInfo);
    assert.equal(
      appInfo.cell_info[ROLE_NAME].length,
      2,
      "disabled clone cell is still part of app info",
    );
    const params: CallZomeRequest = {
      cell_id: cloneCell.cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    try {
      await client.callZome(params);
      assert.fail();
    } catch {
      assert("disabled clone call cannot be called");
    }
  })();
});

test("can enable a disabled clone cell", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { client, admin } = await installAppAndDna(adminPort);
    const createCloneCellParams: CreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await client.createCloneCell(createCloneCellParams);
    await client.disableCloneCell({
      clone_cell_id: {
        type: "dna_hash",
        value: cloneCell.cell_id[0],
      },
    });

    const enabledCloneCell = await client.enableCloneCell({
      clone_cell_id: {
        type: "clone_id",
        value: CloneIdHelper.fromRoleName(cloneCell.clone_id).toString(),
      },
    });

    const appInfo = await client.appInfo();
    assert(appInfo);
    assert.equal(
      appInfo.cell_info[ROLE_NAME].length,
      2,
      "clone cell is part of app info",
    );
    const params: CallZomeRequest = {
      cell_id: enabledCloneCell.cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    await admin.authorizeSigningCredentials(cloneCell.cell_id);
    const response = await client.callZome(params);
    assert.equal(response, "foo", "enabled clone cell can be called");
  })();
});

test("can delete archived clone cells of an app", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { installed_app_id, client, admin } =
      await installAppAndDna(adminPort);
    const createCloneCellParams: CreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await client.createCloneCell(createCloneCellParams);
    createCloneCellParams.modifiers.network_seed = "clone-1";
    await client.disableCloneCell({
      clone_cell_id: { type: "dna_hash", value: cloneCell.cell_id[0] },
    });

    await admin.deleteCloneCell({
      app_id: installed_app_id,
      clone_cell_id: { type: "dna_hash", value: cloneCell.cell_id[0] },
    });

    try {
      await client.enableCloneCell({
        clone_cell_id: { type: "dna_hash", value: cloneCell.cell_id[0] },
      });
      assert.fail();
    } catch {
      assert("deleted clone cell cannot be enabled");
    }
  })();
});

test("requests get canceled if the websocket closes while waiting for a response", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { cell_id, client, admin } = await installAppAndDna(adminPort);
    await admin.authorizeSigningCredentials(cell_id);

    const call1 = client.callZome(
      {
        cell_id,
        zome_name: TEST_ZOME_NAME,
        fn_name: "waste_some_time",
        provenance: cell_id[1],
        payload: null,
      },
      1000,
    );
    const call2 = client.callZome(
      {
        cell_id,
        zome_name: TEST_ZOME_NAME,
        fn_name: "waste_some_time",
        provenance: cell_id[1],
        payload: null,
      },
      1000,
    );

    await delay(100);

    const closeEventCode = 1000;
    await client.client.close(closeEventCode);
    assert.ok(
      client.client.socket.readyState !== client.client.socket.OPEN,
      "ws is not open",
    );

    const [res1, res2] = await Promise.allSettled([call1, call2]);
    assert(res1.status === "rejected");
    assert.isTrue(
      res1.reason instanceof HolochainError,
      "res1 is a HolochainError",
    );
    assert.equal(
      res1.reason.name,
      "ClientClosedWithPendingRequests",
      "res1 is correct holochain error",
    );
    assert(res2.status === "rejected");
    assert.equal(
      res2.reason.name,
      "ClientClosedWithPendingRequests",
      "res1 is correct holochain error",
    );
  })();
});

test("can fetch storage info", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { installed_app_id, admin } = await installAppAndDna(adminPort);

    const response = await admin.storageInfo();

    assert.equal(response.blobs.length, 1);
    assert.isTrue(
      response.blobs.some((blob) =>
        blob.value.used_by.includes(installed_app_id),
      ),
    );
  })();
});

test("can dump network stats", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { admin, client } = await installAppAndDna(adminPort);

    await retryUntilTimeout(
      async () => {
        const adminWsResponse = await admin.dumpNetworkStats();
        return adminWsResponse.transport_stats.peer_urls.length;
      },
      0,
      "no peer URL received",
      500,
      15_000,
    );
    const adminWsResponse = await admin.dumpNetworkStats();

    assert.equal(
      adminWsResponse.transport_stats.backend,
      "iroh",
      "unexpected transport backend",
    );
    assert.equal(adminWsResponse.transport_stats.peer_urls.length, 1);
    const peerUrl = new URL(adminWsResponse.transport_stats.peer_urls[0]);
    assert.equal(peerUrl.hostname, "127.0.0.1");
    assert.equal(peerUrl.protocol, "http:");
    assert.deepEqual(adminWsResponse.transport_stats.connections, []);

    const appWsResponse = await client.dumpNetworkStats();
    assert.deepEqual(appWsResponse, adminWsResponse);
  })();
});

test("can dump network metrics", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { admin, cell_id, client } = await installAppAndDna(adminPort);

    // Call it without dna_hash field
    const response = await admin.dumpNetworkMetrics({
      include_dht_summary: true,
    });
    const dnaHash = encodeHashToBase64(cell_id[0]);
    assert(response[dnaHash], "expected entry in map under dna hash");
    assert.deepEqual(
      response[dnaHash].fetch_state_summary.pending_requests,
      {},
    );
    assert.deepEqual(
      response[dnaHash].gossip_state_summary.accepted_rounds,
      [],
    );
    assert.deepEqual(
      response[dnaHash].gossip_state_summary.initiated_round,
      null,
    );
    assert.deepEqual(response[dnaHash].gossip_state_summary.peer_meta, {});
    assert.deepEqual(response[dnaHash].local_agents, [
      { agent: cell_id[1], storage_arc: null, target_arc: [0, 4294967295] },
    ]);

    // call it with dna_hash field
    const response2 = await admin.dumpNetworkMetrics({
      dna_hash: cell_id[0],
      include_dht_summary: true,
    });

    assert.deepEqual(response, response2);

    // call it on the app websocket as well, the response should be identical
    const appWsResponse = await client.dumpNetworkMetrics({
      include_dht_summary: true,
    });
    assert.deepEqual(appWsResponse, response);

    // call it with dna_hash field
    const appWsResponse2 = await client.dumpNetworkMetrics({
      dna_hash: cell_id[0],
      include_dht_summary: true,
    });
    assert.deepEqual(appWsResponse2, response);
  })();
});

test("can update coordinators of an app", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { client, admin, cell_id } = await installAppAndDna(adminPort);
    await admin.authorizeSigningCredentials(cell_id);

    try {
      await client.callZome({
        cell_id,
        zome_name: "coordinator2",
        fn_name: "echo_hi",
        provenance: cell_id[1],
        payload: null,
      });
      assert.fail();
    } catch {
      assert("coordinator2 zome does not exist yet");
    }

    const bundle = await makeCoordinatorZomeBundle();

    await admin.updateCoordinators({
      cell_id,
      source: {
        type: "bundle",
        value: bundle,
      },
    });

    const dnaDef = await admin.getDnaDefinition(cell_id);
    const zomeNames = dnaDef.coordinator_zomes.map((x) => x[0]);

    assert.ok(
      zomeNames.includes("coordinator2"),
      "coordinator zomes can be updated",
    );

    const response = await client.callZome({
      cell_id,
      zome_name: "coordinator2",
      fn_name: "echo_hi",
      provenance: cell_id[1],
      payload: null,
    });

    assert.equal(response, "hi", "updated coordinator zomes can be called");
  })();
});

test("client reconnects websocket if closed before making a zome call", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { cell_id, client, admin } = await installAppAndDna(
      adminPort,
      false,
      0,
    );
    await admin.authorizeSigningCredentials(cell_id);
    await client.client.close();
    const callParams = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "bar",
      provenance: cell_id[1],
      payload: null,
    };
    try {
      await client.callZome(callParams);
    } catch (error) {
      assert.fail(`websocket was not reconnected: ${error}`);
    }
  })();
});

test("client fails to reconnect to websocket if closed before making a zome call if the provided token is invalid", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { cell_id, client, admin } = await installAppAndDna(adminPort);
    await admin.authorizeSigningCredentials(cell_id);
    await client.client.close();
    const callParams = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "bar",
      provenance: cell_id[1],
      payload: null,
    };

    // Websocket is closed and app authentication token has expired. Websocket reconnection
    // should fail.
    try {
      console.log("now calling");
      console.log();
      await client.callZome(callParams);
      assert.fail(
        "reconnecting to websocket should have failed due to an invalid token.",
      );
    } catch (error) {
      assert.isTrue(
        error instanceof HolochainError,
        "error should be of type HolochainError",
      );
      assert(error instanceof HolochainError);
      assert.equal(
        error.name,
        "InvalidTokenError",
        "expected an InvalidTokenError",
      );
    }

    // Websocket reconnection has failed and subsequent calls should just return a websocket
    // closed error.
    try {
      await client.callZome(callParams);
      assert.fail("should not be attempted to reconnect websocket");
    } catch (error) {
      assert.isTrue(
        error instanceof HolochainError,
        "error should be of type HolochainError",
      );
      assert(error instanceof HolochainError);
      assert.equal(
        error.name,
        "WebsocketClosedError",
        "expected a WebsocketClosedError",
      );
    }
  })();
});

test("Rust enums are serialized correctly", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const { client, admin, cell_id } = await installAppAndDna(adminPort);
    await admin.authorizeSigningCredentials(cell_id);

    const serializationEnumInputVariant = "Input";
    const response = await client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "enum_serialization",
      provenance: cell_id[1],
      payload: serializationEnumInputVariant,
    });
    assert.deepEqual(response, { Output: "success" });
  })();
});
