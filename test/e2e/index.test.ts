import { decode, encode } from "@msgpack/msgpack";
import getPort from "get-port";
import yaml from "js-yaml";
import fs from "node:fs";
import { assert, test } from "vitest";
import zlib from "zlib";
import {
  ActionHash,
  ActionType,
  AdminWebsocket,
  AppBundle,
  AppEntryDef,
  AppStatusFilter,
  AppWebsocket,
  CallZomeRequest,
  CellProvisioningStrategy,
  CellType,
  CloneIdHelper,
  CreateCloneCellRequest,
  DumpStateResponse,
  FullStateDump,
  HolochainError,
  Link,
  ProvisionedCell,
  Record,
  RegisterAgentActivity,
  RoleName,
  Signal,
  SignalType,
  encodeHashToBase64,
  fakeDnaHash,
  generateSigningKeyPair,
  getNonceExpiration,
  getSigningCredentials,
  isSameCell,
  randomNonce,
} from "../../src/index.js";
import {
  FIXTURE_PATH,
  cleanSandboxConductors,
  createAppWsAndInstallApp,
  launch,
  makeCoordinatorZomeBundle,
  retryUntilTimeout,
  runLocalServices,
  stopConductor,
  stopLocalServices,
  withApp,
  withConductor,
} from "./common.js";

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

test(
  "admin_wssmoke test: installApp + uninstallApp",
  withApp(async (testCase) => {
    const { admin_ws } = testCase;
    const installed_app_id = testCase.installed_app_id;

    let allAppsInfo = await admin_ws.listApps({});
    assert.equal(allAppsInfo.length, 1, "all apps listed");

    const disabledAppsInfo = await admin_ws.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    assert.equal(disabledAppsInfo.length, 0, "0 disabled app");

    const activeApps = await admin_ws.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    assert.equal(activeApps.length, 1);
    assert.equal(activeApps[0].installed_app_id, installed_app_id);

    const runningAppsInfo = await admin_ws.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    const disabledAppsInfo2 = await admin_ws.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    const pausedAppsInfo2 = await admin_ws.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    assert.equal(pausedAppsInfo2.length, 0);
    assert.equal(disabledAppsInfo2.length, 0);
    assert.equal(runningAppsInfo.length, 1);
    assert.equal(runningAppsInfo[0].cell_info[ROLE_NAME].length, 1);
    assert.deepEqual(runningAppsInfo[0].status, { type: "enabled" });

    await admin_ws.attachAppInterface({
      port: 0,
      allowed_origins: "client-test-app",
    });
    await admin_ws.disableApp({ installed_app_id });

    const runningAppsInfo3 = await admin_ws.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    const disabledAppsInfo3 = await admin_ws.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    assert.equal(runningAppsInfo3.length, 0);
    assert.equal(disabledAppsInfo3.length, 1);
    assert.deepEqual(disabledAppsInfo3[0].status, {
      type: "disabled",
      value: { type: "user" },
    });

    const dnas = await admin_ws.listDnas();
    assert.equal(dnas.length, 1);

    const activeApps3 = await admin_ws.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    assert.equal(activeApps3.length, 0);
    // NB: missing dumpState because it requires a valid cell_id

    await admin_ws.uninstallApp({ installed_app_id });
    allAppsInfo = await admin_ws.listApps({});
    assert.equal(allAppsInfo.length, 0);
  }),
);

test(
  "admin_wssmoke test: installBundle",
  withApp(async (testCase) => {
    const { admin_ws, installed_app_id, app_ws } = testCase;
    const installedApp = await app_ws.appInfo();
    const runningApps1 = await admin_ws.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    assert.equal(runningApps1.length, 1);

    const enabledAppInfo = await admin_ws.enableApp({ installed_app_id });
    assert.deepEqual(enabledAppInfo.status, { type: "enabled" });
    assert.equal(enabledAppInfo.installed_app_id, installed_app_id);

    const runningApps2 = await admin_ws.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    assert.equal(runningApps2.length, 1);
    assert.equal(runningApps2[0].installed_app_id, installed_app_id);

    const cellIds = await admin_ws.listCellIds();
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

    await admin_ws.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    await admin_ws.disableApp({ installed_app_id });

    const dnas = await admin_ws.listDnas();
    assert.equal(dnas.length, 1);

    const activeApps3 = await admin_ws.listApps({
      status_filter: AppStatusFilter.Enabled,
    });
    assert.equal(activeApps3.length, 0);
  }),
);

test(
  "can call a zome function and then deactivate",
  withApp(async (testCase) => {
    const { installed_app_id, cell_id, app_ws, admin_ws } = testCase;
    let info = await app_ws.appInfo(1000);
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

    await admin_ws.authorizeSigningCredentials(cell_id);

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

    const response = await app_ws.callZome(zomeCallPayload, 30000);
    assert.equal(response, null, "app entry def deserializes correctly");

    await admin_ws.disableApp({ installed_app_id });
    info = await app_ws.appInfo(1000);
    assert(info);
    assert.deepEqual(
      info.status,
      { type: "disabled", value: { type: "user" } },
      "disabled reason user",
    );
  }),
);

test(
  "can call a zome function with different sets of params",
  withApp(async (testCase) => {
    const { cell_id, app_ws } = testCase;

    const request: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: cell_id[1],
      payload: null,
    };
    let response = await app_ws.callZome(request, 30000);
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

    response = await app_ws.callZome(zomeCallPayload, 30000);
    assert.equal(response, "foo", "zome can be called with all parameters");
  }),
);

test(
  "can call attachAppInterface without specific port",
  withApp(async (testCase) => {
    const { admin_ws, installed_app_id } = testCase;
    const { port } = await admin_ws.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    assert.isTrue(typeof port === "number", "returned a valid app port");
    const issued = await admin_ws.issueAppAuthenticationToken({
      installed_app_id,
    });
    await AppWebsocket.connect({
      url: new URL(`ws://localhost:${port}`),
      wsClientOptions: { origin: "client-test-app" },
      token: issued.token,
    });
  }),
);

test(
  "invalid app authentication token fails",
  withApp(async (testCase) => {
    const { admin_ws } = testCase;
    const { port } = await admin_ws.attachAppInterface({
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
  }),
);

test(
  "app websocket connection from allowed origin is established",
  withApp(async (testCase) => {
    const { admin_ws, installed_app_id } = testCase;
    const allowedOrigin = "client-test-app";
    const { port } = await admin_ws.attachAppInterface({
      allowed_origins: allowedOrigin,
    });
    const issued = await admin_ws.issueAppAuthenticationToken({
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
  }),
);

test(
  "app websocket connection from disallowed origin is rejected",
  withApp(async (testCase) => {
    const { admin_ws, installed_app_id } = testCase;
    const { port } = await admin_ws.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    const issued = await admin_ws.issueAppAuthenticationToken({
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
  }),
);

test(
  "app_wserrors are HolochainErrors",
  withApp(async (testCase) => {
    const { cell_id, app_ws, admin_ws } = testCase;
    const info = await app_ws.appInfo(1000);
    assert(info);
    assert(info.cell_info[ROLE_NAME][0].type === CellType.Provisioned);

    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "fn_that_does_not_exist",
      provenance: cell_id[1],
      payload: null,
    };

    await admin_ws.authorizeSigningCredentials(cell_id);

    try {
      await app_ws.callZome(zomeCallPayload);
      assert.fail("This zome call should have thrown an error.");
    } catch (error) {
      assert.ok(
        error instanceof HolochainError,
        "error is an instance of HolochainError",
      );
      assert(error instanceof HolochainError);
      assert.equal(error.name, "internal_error", "error has correct name");
    }
  }),
);

test("can install app with roles_settings", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const installed_app_id = "app";
    const admin_ws = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin_ws.generateAgentPubKey();

    const progenitorKey = Uint8Array.from(fakeAgentPubKey());

    await admin_ws.installApp({
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

    const apps = await admin_ws.listApps({});
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
    const admin_ws = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin_ws.generateAgentPubKey();

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

    await admin_ws.installApp({
      installed_app_id,
      agent_key: agent,
      source: {
        type: "bytes",
        value: zippedAppBundle,
      },
    });

    const { port: appPort } = await admin_ws.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    const issued = await admin_ws.issueAppAuthenticationToken({
      installed_app_id,
    });
    const app_ws = await AppWebsocket.connect({
      url: new URL(`ws://localhost:${appPort}`),
      wsClientOptions: { origin: "client-test-app" },
      token: issued.token,
    });

    let appInfo = await app_ws.appInfo();
    assert.deepEqual(
      appInfo.status,
      { type: "awaiting_memproofs" },
      "app is not in status awaiting_memproofs",
    );

    try {
      await app_ws.enableApp();
      assert.fail("enabling app should fail while memproofs not provided");
    } catch (error) {
      assert(error instanceof Error);
      assert.equal(
        error.message,
        "Other: app not in correct state to enable",
        "enabling app fails while memproofs not provided",
      );
    }

    const response = await app_ws.provideMemproofs({});
    assert.equal(response, undefined, "memproofs provided successfully");

    appInfo = await app_ws.appInfo();
    assert.deepEqual(
      appInfo.status,
      {
        type: "disabled",
        value: { type: "not_started_after_providing_memproofs" },
      },
      "app is disabled after providing memproofs",
    );

    await app_ws.enableApp();
    appInfo = await app_ws.appInfo();
    assert.deepEqual(appInfo.status, { type: "enabled" }, "app is running");
  })();
});

test("generated signing key has same location bytes as original agent pub key", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const admin_ws = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin_ws.generateAgentPubKey();
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
    const admin_ws = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin_ws.generateAgentPubKey();

    const appBundleBytes = fs.readFileSync(`${FIXTURE_PATH}/test.happ`);

    const app = await admin_ws.installApp({
      installed_app_id,
      agent_key: agent,
      source: {
        type: "bytes",
        value: appBundleBytes,
      },
    });
    await admin_ws.enableApp({ installed_app_id });
    const { port: appPort } = await admin_ws.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    const issued = await admin_ws.issueAppAuthenticationToken({
      installed_app_id,
    });
    const app_ws = await AppWebsocket.connect({
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

    await admin_ws.authorizeSigningCredentials(cell_id);

    const response = await app_ws.callZome(zomeCallPayload, 30000);
    assert.equal(response, "foo", "zome call succeeds");
  })();
});

test(
  "stateDump",
  withApp(async (testCase) => {
    const { app_ws, cell_id, admin_ws } = testCase;
    const info = await app_ws.appInfo();
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

    await admin_ws.authorizeSigningCredentials(cell_id);

    const response = await app_ws.callZome(zomeCallPayload);
    assert.equal(response, "foo");

    const state: DumpStateResponse = await admin_ws.dumpState({
      cell_id: (info.cell_info[ROLE_NAME][0].value as ProvisionedCell).cell_id,
    });
    assert.equal(state[0].source_chain_dump.records.length, 6);
    assert.equal(state[0].source_chain_dump.records[0].action.type, "Dna");
  }),
);

test(
  "fullStateDump with ChainOps",
  withApp(async (testCase) => {
    const { admin_ws, cell_id } = testCase;
    const state: FullStateDump = await admin_ws.dumpFullState({
      cell_id,
    });
    for (const dhtOp of state.integration_dump.integrated) {
      assert.isTrue("ChainOp" in dhtOp, "dht op is a chain op");
    }
  }),
);

test(
  "can receive a signal using event handler",
  withApp(async (testCase) => {
    const { cell_id, admin_ws, app_ws } = testCase;
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
    await admin_ws.authorizeSigningCredentials(cell_id);

    app_ws.on("signal", signalCb);

    // trigger an emit_signal
    await app_ws.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "emitter",
      provenance: fakeAgentPubKey(),
      payload: null,
    });
    await signalReceivedPromise;
  }),
);

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

test(
  "zome call timeout can be overridden",
  withApp(async (testCase) => {
    const { app_ws, cell_id } = testCase;
    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "waste_some_time",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    try {
      await app_ws.callZome(zomeCallPayload, 1);
      assert.fail("zome call did not time out");
    } catch {
      assert("zome call timed out");
    }
  }),
);

test("can inject agent info", async () => {
  const localServices = await runLocalServices();
  const adminPort1 = await getAdminPort();
  const conductor1 = await launch(
    adminPort1,
    localServices.bootstrapServerUrl,
    localServices.signalingServerUrl,
  );
  const installed_app_id = "app";
  const admin1 = await AdminWebsocket.connect({
    url: getAdminWsUrl(adminPort1),
    wsClientOptions: { origin: "client-test-admin" },
  });

  // There shouldn't be any agent infos yet.
  let agentInfos1 = await admin1.agentInfo({ dna_hashes: null });
  assert.equal(agentInfos1.length, 0, "0 agent infos");

  const agent1 = await admin1.generateAgentPubKey();
  const result1 = await admin1.installApp({
    source: {
      type: "path",
      value: `${FIXTURE_PATH}/test.happ`,
    },
    installed_app_id,
    agent_key: agent1,
  });
  assert(result1.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
  const app1_cell = result1.cell_info[ROLE_NAME][0].value.cell_id;
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
    "agent infos didn't make it to the peer store",
    500,
    15_000,
  );

  // There should be one agent info now.
  agentInfos1 = await admin1.agentInfo({ dna_hashes: null });
  assert.equal(agentInfos1.length, 1, "number of agent infos is 1");

  // Now confirm that we can ask for agents in just one DNA.
  const dnaAgentInfos = await admin1.agentInfo({
    dna_hashes: [app1_cell[0]],
  });
  assert.deepEqual(
    dnaAgentInfos,
    agentInfos1,
    "DNA agent infos match app agent infos",
  );

  const adminPort2 = await getAdminPort();
  const conductor2 = await launch(
    adminPort2,
    localServices.bootstrapServerUrl,
    localServices.signalingServerUrl,
  );
  const admin2 = await AdminWebsocket.connect({
    url: getAdminWsUrl(adminPort2),
    wsClientOptions: { origin: "client-test-admin" },
  });
  let agentInfos2 = await admin2.agentInfo({ dna_hashes: null });
  assert.equal(
    agentInfos2.length,
    0,
    "number of agent infos on conductor 2 is 0",
  );

  const result2 = await admin2.installApp({
    source: {
      type: "path",
      value: `${FIXTURE_PATH}/test.happ`,
    },
  });
  assert.deepEqual(result1.cell_info[0], result2.cell_info[0]);
  await admin2.enableApp({ installed_app_id: result2.installed_app_id }, 1000);

  await retryUntilTimeout(
    async () => {
      const agentInfos = await admin2.agentInfo({ dna_hashes: null });
      return agentInfos.length;
    },
    0,
    "agent infos didn't make it to the peer store",
    500,
    15_000,
  );

  await admin2.addAgentInfo({ agent_infos: agentInfos1 });
  agentInfos2 = await admin2.agentInfo({ dna_hashes: null });
  assert.equal(
    agentInfos2.length,
    1,
    "number of agent infos on conductor 2 is 1",
  );

  await stopLocalServices(localServices.servicesProcess);
  await stopConductor(conductor1);
  await stopConductor(conductor2);
  await cleanSandboxConductors();
});

test("can query peer meta info over admin_wsand app websocket", async () => {
  const localServices = await runLocalServices();
  const adminPort1 = await getAdminPort();
  const conductor1 = await launch(
    adminPort1,
    localServices.bootstrapServerUrl,
    localServices.signalingServerUrl,
  );
  const {
    cell_id: cell_id1,
    app_ws: appClient1,
    admin_ws: admin1,
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
  const agentInfo1 = JSON.parse(agentInfos1[0]).agentInfo;
  const agentUrl1 = JSON.parse(agentInfo1).url;

  // Start a second conductor and install the same app
  const adminPort2 = await getAdminPort();
  const conductor2 = await launch(
    adminPort2,
    localServices.bootstrapServerUrl,
    localServices.signalingServerUrl,
  );

  const {
    cell_id: cell_id2,
    app_ws: appClient2,
    admin_ws: admin2,
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

  // Now have agent 2 get peer meta info for agent 1 via the admin_wswebsocket
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

test(
  "can query agents over app ws",
  withApp(async (testCase) => {
    const { app_ws } = testCase;
    await retryUntilTimeout(
      async () => {
        const agentInfos = await app_ws.agentInfo({ dna_hashes: null });
        return agentInfos.length;
      },
      0,
      "agent infos didn't make it to the peer store",
      500,
      15_000,
    );

    // There should be one agent info.
    const agentInfos = await app_ws.agentInfo({ dna_hashes: null });
    assert.equal(
      agentInfos.length,
      1,
      `expected 1 agent info bug got ${agentInfos.length}`,
    );

    try {
      await app_ws.agentInfo({
        dna_hashes: [await fakeDnaHash()],
      });
      assert.fail("querying for non-existing space should fail");
    } catch {
      assert("querying for non-existing space should fail");
    }

    const appInfo = await app_ws.appInfo();
    const cell = appInfo.cell_info[ROLE_NAME][0];
    assert(cell.type === CellType.Provisioned);
    const dnaHash = cell.value.cell_id[0];
    const agentInfosForDna = await app_ws.agentInfo({
      dna_hashes: [dnaHash],
    });
    assert.isTrue(
      agentInfosForDna.length === 1,
      "number of agent infos for app's DNA is 1",
    );
    assert.deepEqual(agentInfos, agentInfosForDna);
  }),
);

test(
  "create link",
  withApp(async (testCase) => {
    const { app_ws, cell_id } = testCase;

    const tag = "test_tag";
    const link: Link = await app_ws.callZome({
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
  }),
);

test(
  "create and delete link",
  withApp(async (testCase) => {
    const { app_ws, cell_id } = testCase;

    const linkHash: ActionHash = await app_ws.callZome({
      cell_id,
      provenance: cell_id[1],
      zome_name: TEST_ZOME_NAME,
      fn_name: "create_and_delete_link",
      payload: null,
    });
    const activity: RegisterAgentActivity[] = await app_ws.callZome({
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
  }),
);

test("admin_wssmoke test: listAppInterfaces + attachAppInterface", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const admin_ws = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });

    let interfaces = await admin_ws.listAppInterfaces();
    assert.equal(interfaces.length, 0);

    await admin_ws.attachAppInterface({
      allowed_origins: "client-test-app",
    });

    interfaces = await admin_ws.listAppInterfaces();
    assert.equal(interfaces.length, 1);
    assert.isTrue(interfaces[0].port > 0);
    assert.equal(interfaces[0].allowed_origins, "client-test-app");
    assert.equal(interfaces[0].installed_app_id, null);
  })();
});

test(
  "can use some of the defined js bindings",
  withApp(async (testCase) => {
    const { app_ws, cell_id, admin_ws, installed_app_id } = testCase;
    let info = await app_ws.appInfo(1000);
    assert(info);
    assert(info.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    assert.deepEqual(info.cell_info[ROLE_NAME][0].value.cell_id, cell_id);
    assert.ok(ROLE_NAME in info.cell_info);
    assert.deepEqual(info.status, { type: "enabled" });
    await admin_ws.authorizeSigningCredentials(cell_id);
    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    const response = await app_ws.callZome(zomeCallPayload, 30000);
    assert.equal(response, "foo");

    await admin_ws.disableApp({ installed_app_id });
    info = await app_ws.appInfo(1000);
    assert(info);
    assert.deepEqual(info.status, {
      type: "disabled",
      value: { type: "user" },
    });
  }),
);

test("admin_wssmoke test: install 2 hApp bundles with different network seeds", async () => {
  const adminPort = await getAdminPort();
  await withConductor(adminPort, async () => {
    const admin_ws = await AdminWebsocket.connect({
      url: getAdminWsUrl(adminPort),
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent_key = await admin_ws.generateAgentPubKey();

    const installedApp1 = await admin_ws.installApp({
      source: {
        type: "path",
        value: `${FIXTURE_PATH}/test.happ`,
      },
      agent_key,
      installed_app_id: "test-app1",
      network_seed: "1",
    });
    const installedApp2 = await admin_ws.installApp({
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

test(
  "can create a callable clone cell",
  withApp(async (testCase) => {
    const { app_ws, admin_ws } = testCase;
    const appInfo = await app_ws.appInfo();
    assert(appInfo);

    const createCloneCellParams: CreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await app_ws.createCloneCell(createCloneCellParams);

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
    await admin_ws.authorizeSigningCredentials(cloneCell.cell_id);
    const response = await app_ws.callZome(zomeCallPayload);
    assert.equal(
      response,
      "foo",
      "clone cell can be called with same zome call as base cell",
    );
  }),
);

test(
  "can disable a clone cell",
  withApp(async (testCase) => {
    const { app_ws, admin_ws } = testCase;
    const createCloneCellParams: CreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await app_ws.createCloneCell(createCloneCellParams);

    await admin_ws.authorizeSigningCredentials(cloneCell.cell_id);

    await app_ws.disableCloneCell({
      clone_cell_id: {
        type: "dna_hash",
        value: cloneCell.cell_id[0],
      },
    });

    const appInfo = await app_ws.appInfo();
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
      await app_ws.callZome(params);
      assert.fail();
    } catch {
      assert("disabled clone call cannot be called");
    }
  }),
);

test(
  "can enable a disabled clone cell",
  withApp(async (testCase) => {
    const { app_ws, admin_ws } = testCase;
    const createCloneCellParams: CreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await app_ws.createCloneCell(createCloneCellParams);
    await app_ws.disableCloneCell({
      clone_cell_id: {
        type: "dna_hash",
        value: cloneCell.cell_id[0],
      },
    });

    const enabledCloneCell = await app_ws.enableCloneCell({
      clone_cell_id: {
        type: "clone_id",
        value: CloneIdHelper.fromRoleName(cloneCell.clone_id).toString(),
      },
    });

    const appInfo = await app_ws.appInfo();
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
    await admin_ws.authorizeSigningCredentials(cloneCell.cell_id);
    const response = await app_ws.callZome(params);
    assert.equal(response, "foo", "enabled clone cell can be called");
  }),
);

test(
  "can delete archived clone cells of an app",
  withApp(async (testCase) => {
    const { app_ws, admin_ws, installed_app_id } = testCase;
    const createCloneCellParams: CreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await app_ws.createCloneCell(createCloneCellParams);
    createCloneCellParams.modifiers.network_seed = "clone-1";
    await app_ws.disableCloneCell({
      clone_cell_id: { type: "dna_hash", value: cloneCell.cell_id[0] },
    });

    await admin_ws.deleteCloneCell({
      app_id: installed_app_id,
      clone_cell_id: { type: "dna_hash", value: cloneCell.cell_id[0] },
    });

    try {
      await app_ws.enableCloneCell({
        clone_cell_id: { type: "dna_hash", value: cloneCell.cell_id[0] },
      });
      assert.fail();
    } catch {
      assert("deleted clone cell cannot be enabled");
    }
  }),
);

test(
  "requests get canceled if the websocket closes while waiting for a response",
  withApp(async (testCase) => {
    const { app_ws, cell_id } = testCase;

    const call1 = app_ws.callZome(
      {
        cell_id,
        zome_name: TEST_ZOME_NAME,
        fn_name: "waste_some_time",
        provenance: cell_id[1],
        payload: null,
      },
      1000,
    );
    const call2 = app_ws.callZome(
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
    await app_ws.client.close(closeEventCode);
    assert.ok(
      app_ws.client.socket.readyState !== app_ws.client.socket.OPEN,
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
  }),
);

test(
  "can fetch storage info",
  withApp(async (testCase) => {
    const { installed_app_id, admin_ws } = testCase;

    const response = await admin_ws.storageInfo();

    assert.equal(response.blobs.length, 1);
    assert.isTrue(
      response.blobs.some((blob) =>
        blob.value.used_by.includes(installed_app_id),
      ),
    );
  }),
);

test(
  "can dump network stats",
  withApp(async (testCase) => {
    const { app_ws, admin_ws } = testCase;

    await retryUntilTimeout(
      async () => {
        const adminWsResponse = await admin_ws.dumpNetworkStats();
        return adminWsResponse.transport_stats.peer_urls.length;
      },
      0,
      "no peer URL received",
      500,
      15_000,
    );
    const adminWsResponse = await admin_ws.dumpNetworkStats();

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

    const appWsResponse = await app_ws.dumpNetworkStats();
    assert.deepEqual(appWsResponse, adminWsResponse);
  }),
);

test(
  "can dump network metrics",
  withApp(async (testCase) => {
    const { app_ws, admin_ws, cell_id } = testCase;

    // Call it without dna_hash field
    const response = await admin_ws.dumpNetworkMetrics({
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
    const response2 = await admin_ws.dumpNetworkMetrics({
      dna_hash: cell_id[0],
      include_dht_summary: true,
    });

    assert.deepEqual(response, response2);

    // call it on the app websocket as well, the response should be identical
    const appWsResponse = await app_ws.dumpNetworkMetrics({
      include_dht_summary: true,
    });
    assert.deepEqual(appWsResponse, response);

    // call it with dna_hash field
    const appWsResponse2 = await app_ws.dumpNetworkMetrics({
      dna_hash: cell_id[0],
      include_dht_summary: true,
    });
    assert.deepEqual(appWsResponse2, response);
  }),
);

test(
  "can update coordinators of an app",
  withApp(async (testCase) => {
    const { app_ws, admin_ws, cell_id } = testCase;

    try {
      await app_ws.callZome({
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

    await admin_ws.updateCoordinators({
      cell_id,
      source: {
        type: "bundle",
        value: bundle,
      },
    });

    const dnaDef = await admin_ws.getDnaDefinition(cell_id);
    const zomeNames = dnaDef.coordinator_zomes.map((x) => x[0]);

    assert.ok(
      zomeNames.includes("coordinator2"),
      "coordinator zomes can be updated",
    );

    const response = await app_ws.callZome({
      cell_id,
      zome_name: "coordinator2",
      fn_name: "echo_hi",
      provenance: cell_id[1],
      payload: null,
    });

    assert.equal(response, "hi", "updated coordinator zomes can be called");
  }),
);

test(
  "app_wsreconnects websocket if closed before making a zome call",
  withApp(
    async (testCase) => {
      const { app_ws, cell_id } = testCase;

      await app_ws.client.close();
      const callParams = {
        cell_id,
        zome_name: TEST_ZOME_NAME,
        fn_name: "bar",
        provenance: cell_id[1],
        payload: null,
      };
      try {
        await app_ws.callZome(callParams);
      } catch (error) {
        assert.fail(`websocket was not reconnected: ${error}`);
      }
    },
    false,
    0,
  ),
);

test(
  "app_wsfails to reconnect to websocket if closed before making a zome call if the provided token is invalid",
  withApp(async (testCase) => {
    const { app_ws, cell_id } = testCase;

    await app_ws.client.close();
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
      await app_ws.callZome(callParams);
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
      await app_ws.callZome(callParams);
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
  }),
);

test(
  "Rust enums are serialized correctly",
  withApp(async (testCase) => {
    const { app_ws, cell_id } = testCase;

    const serializationEnumInputVariant = "Input";
    const response = await app_ws.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "enum_serialization",
      provenance: cell_id[1],
      payload: serializationEnumInputVariant,
    });
    assert.deepEqual(response, { Output: "success" });
  }),
);
