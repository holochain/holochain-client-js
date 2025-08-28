import { decode, encode } from "@msgpack/msgpack";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "tape";
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
  DnaBundle,
  DumpStateResponse,
  EnableAppResponse,
  FullStateDump,
  HolochainError,
  AppInfoStatus,
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
} from "../../src";
import {
  FIXTURE_PATH,
  cleanSandboxConductors,
  createAppWsAndInstallApp,
  installAppAndDna,
  launch,
  makeCoordinatorZomeBundle,
  retryUntilTimeout,
  runLocalServices,
  stopLocalServices,
  withConductor,
} from "./common.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fakeAgentPubKey = () =>
  Buffer.from(
    [0x84, 0x20, 0x24].concat(
      "000000000000000000000000000000000000"
        .split("")
        .map((x) => parseInt(x, 10))
    )
  );

const ADMIN_PORT = 33001;
const ADMIN_PORT_1 = 33002;

const ROLE_NAME: RoleName = "foo";
const TEST_ZOME_NAME = "foo";

export const ADMIN_WS_URL = new URL(`ws://localhost:${ADMIN_PORT}`);

test(
  "admin smoke test: registerDna + installApp + uninstallApp",
  withConductor(ADMIN_PORT, async (t) => {
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: ADMIN_WS_URL,
      wsClientOptions: { origin: "client-test-admin" },
    });

    const agent_key = await admin.generateAgentPubKey();
    t.ok(agent_key, "agent key generated");

    const path = `${FIXTURE_PATH}/test.dna`;
    const hash = await admin.registerDna({
      source: {
        type: "path",
        value: path,
      },
      modifiers: {},
    });
    t.ok(hash, "dna registered");

    const installedApp = await admin.installApp({
      source: {
        type: "path",
        value: `${FIXTURE_PATH}/test.happ`,
      },
      installed_app_id,
      agent_key,
    });
    const status: AppInfoStatus = installedApp.status;
    t.deepEqual(
      status,
      { type: "disabled", value: { reason: { type: "never_started" } } },
      "app installed"
    );

    const runningApps = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(runningApps.length, 0, "no running apps");

    let allAppsInfo = await admin.listApps({});
    t.equal(allAppsInfo.length, 1, "all apps listed");

    const disabledAppsInfo = await admin.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    t.equal(disabledAppsInfo.length, 1, "1 disabled app");
    t.equal(
      disabledAppsInfo[0].cell_info[ROLE_NAME].length,
      1,
      "expected cell in disabled app info"
    );
    t.deepEqual(
      disabledAppsInfo[0].status,
      { type: "disabled", value: { reason: { type: "never_started" } } },
      "disabled app never started"
    );

    const pausedAppsInfo = await admin.listApps({
      status_filter: AppStatusFilter.Paused,
    });
    t.equal(pausedAppsInfo.length, 0, "0 paused apps");

    const { app, errors } = await admin.enableApp({ installed_app_id });
    t.deepEqual(app.status, { type: "running" });
    t.ok(ROLE_NAME in app.cell_info);
    t.ok(Array.isArray(app.cell_info[ROLE_NAME]));
    t.equal(app.installed_app_id, installed_app_id);
    t.equal(errors.length, 0);

    const activeApps2 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(activeApps2.length, 1);
    t.equal(activeApps2[0].installed_app_id, installed_app_id);

    const runningAppsInfo2 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    const disabledAppsInfo2 = await admin.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    const pausedAppsInfo2 = await admin.listApps({
      status_filter: AppStatusFilter.Paused,
    });
    t.equal(pausedAppsInfo2.length, 0);
    t.equal(disabledAppsInfo2.length, 0);
    t.equal(runningAppsInfo2.length, 1);
    t.equal(runningAppsInfo2[0].cell_info[ROLE_NAME].length, 1);
    t.deepEqual(runningAppsInfo2[0].status, { type: "running" });

    await admin.attachAppInterface({
      port: 0,
      allowed_origins: "client-test-app",
    });
    await admin.disableApp({ installed_app_id });

    const runningAppsInfo3 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    const disabledAppsInfo3 = await admin.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    const pausedAppsInfo3 = await admin.listApps({
      status_filter: AppStatusFilter.Paused,
    });
    t.equal(runningAppsInfo3.length, 0);
    t.equal(pausedAppsInfo3.length, 0);
    t.equal(disabledAppsInfo3.length, 1);
    t.deepEqual(disabledAppsInfo3[0].status, {
      type: "disabled",
      value: { reason: { type: "user" } },
    });

    let dnas = await admin.listDnas();
    t.equal(dnas.length, 1);

    const activeApps3 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(activeApps3.length, 0);
    // NB: missing dumpState because it requires a valid cell_id

    // install from hash and network seed
    const newHash = await admin.registerDna({
      source: {
        type: "hash",
        value: hash,
      },
      modifiers: {
        network_seed: "123456",
      },
    });
    t.ok(newHash);

    dnas = await admin.listDnas();
    t.equal(dnas.length, 2);

    await admin.uninstallApp({ installed_app_id });
    allAppsInfo = await admin.listApps({});
    t.equal(allAppsInfo.length, 0);
  })
);

test(
  "admin smoke test: installBundle",
  withConductor(ADMIN_PORT, async (t) => {
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: ADMIN_WS_URL,
      wsClientOptions: { origin: "client-test-admin" },
    });

    const agent_key = await admin.generateAgentPubKey();
    t.ok(agent_key);

    const path = `${FIXTURE_PATH}/test.happ`;
    const installedApp = await admin.installApp({
      source: {
        type: "path",
        value: path,
      },
      agent_key,
      installed_app_id,
    });
    t.ok(installedApp);
    t.deepEqual(installedApp.status, {
      type: "disabled",
      value: { reason: { type: "never_started" } },
    });

    const runningApps1 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(runningApps1.length, 0);

    const enabledAppInfo = await admin.enableApp({ installed_app_id });
    t.deepEqual(enabledAppInfo.app.status, { type: "running" });
    t.equal(enabledAppInfo.app.installed_app_id, installed_app_id);
    t.equal(enabledAppInfo.errors.length, 0);

    const runningApps2 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(runningApps2.length, 1);
    t.equal(runningApps2[0].installed_app_id, installed_app_id);

    const cellIds = await admin.listCellIds();
    t.equal(cellIds.length, 1);
    assert(installedApp.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    t.assert(
      cellIds.some((cellId) =>
        isSameCell(
          cellId,
          (installedApp.cell_info[ROLE_NAME][0].value as ProvisionedCell)
            .cell_id
        )
      )
    );

    await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    await admin.disableApp({ installed_app_id });

    const dnas = await admin.listDnas();
    t.equal(dnas.length, 1);

    const activeApps3 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(activeApps3.length, 0);
  })
);

test(
  "admin register dna with full binary bundle + get dna def",
  withConductor(ADMIN_PORT, async (t) => {
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: ADMIN_WS_URL,
      wsClientOptions: { origin: "client-test-admin" },
    });

    const agent_key = await admin.generateAgentPubKey();
    t.ok(agent_key);

    const path = `${FIXTURE_PATH}/test.dna`;

    const zippedDnaBundle = fs.readFileSync(path);
    const encodedDnaBundle = zlib.gunzipSync(zippedDnaBundle);

    const dnaBundle = decode(encodedDnaBundle.buffer) as DnaBundle;
    const hash = await admin.registerDna({
      source: {
        type: "bundle",
        value: dnaBundle,
      },
      modifiers: {},
    });
    t.ok(hash);

    await admin.installApp({
      source: {
        type: "path",
        value: `${FIXTURE_PATH}/test.happ`,
      },
      installed_app_id,
      agent_key,
    });

    const dnaDefinition = await admin.getDnaDefinition(hash);
    t.equal(dnaDefinition.name, "test-dna", "dna definition: name matches");
    t.equal(
      dnaDefinition.modifiers.network_seed,
      "9a28aac8-337c-11eb-adc1-0Z02acw20115",
      "dna definition: network seed matches"
    );
    assert(Buffer.isBuffer(dnaDefinition.modifiers.properties));
    t.equal(
      decode(dnaDefinition.modifiers.properties),
      null,
      "dna definition: properties match"
    );
    t.equal(
      dnaDefinition.integrity_zomes[0][0],
      "foo",
      "dna definition: integrity zome matches"
    );

    const runningApps1 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(runningApps1.length, 0);

    const enabledAppInfo: EnableAppResponse = await admin.enableApp({
      installed_app_id,
    });
    t.deepEqual(enabledAppInfo.app.status, { type: "running" });
    t.equal(enabledAppInfo.app.installed_app_id, installed_app_id);
    t.equal(enabledAppInfo.errors.length, 0);

    const runningApps2 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(runningApps2.length, 1);
    t.equal(runningApps2[0].installed_app_id, installed_app_id);

    await admin.attachAppInterface({
      port: 0,
      allowed_origins: "client-test-app",
    });
    await admin.disableApp({ installed_app_id });

    const dnas = await admin.listDnas();
    t.equal(dnas.length, 1);

    const runningApps3 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(runningApps3.length, 0);
  })
);

test(
  "can call a zome function and then deactivate",
  withConductor(ADMIN_PORT, async (t) => {
    const { installed_app_id, cell_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    let info = await client.appInfo(1000);
    assert(info, "got app info");
    assert(
      info.cell_info[ROLE_NAME][0].type === CellType.Provisioned,
      "got expected cell"
    );
    t.deepEqual(
      info.cell_info[ROLE_NAME][0].value.cell_id,
      cell_id,
      "got correct cell id"
    );
    t.ok(ROLE_NAME in info.cell_info, "role name correct");
    t.deepEqual(info.status, { type: "running" }, "status is running");

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
    t.equal(response, null, "app entry def deserializes correctly");

    await admin.disableApp({ installed_app_id });
    info = await client.appInfo(1000);
    assert(info);
    t.deepEqual(
      info.status,
      { type: "disabled", value: { reason: { type: "user" } } },
      "disabled reason user"
    );
  })
);

test(
  "can call a zome function with different sets of params",
  withConductor(ADMIN_PORT, async (t) => {
    const { cell_id, client, admin } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const request: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: cell_id[1],
      payload: null,
    };
    let response = await client.callZome(request, 30000);
    t.equal(response, "foo", "zome can be called with all parameters");

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
    t.equal(response, "foo", "zome can be called with all parameters");
  })
);

test(
  "can call attachAppInterface without specific port",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin, installed_app_id } = await installAppAndDna(ADMIN_PORT);
    const { port } = await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    t.assert(typeof port === "number", "returned a valid app port");
    const issued = await admin.issueAppAuthenticationToken({
      installed_app_id,
    });
    await AppWebsocket.connect({
      url: new URL(`ws://localhost:${port}`),
      wsClientOptions: { origin: "client-test-app" },
      token: issued.token,
    });
    t.pass("can connect an app websocket to attached port");
  })
);

test(
  "invalid app authentication token fails",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin } = await installAppAndDna(ADMIN_PORT);
    const { port } = await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    try {
      await AppWebsocket.connect({
        url: new URL(`ws://localhost:${port}`),
        wsClientOptions: { origin: "client-test-app" },
        token: [0],
      });
      t.fail("could connect with invalid authentication token");
    } catch (error) {
      t.assert(error instanceof HolochainError);
      assert(error instanceof HolochainError);
      t.equal(error.name, "InvalidTokenError", "expected InvalidTokenError");
    }
  })
);

test(
  "app websocket connection from allowed origin is established",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin, installed_app_id } = await installAppAndDna(ADMIN_PORT);
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
      t.pass("app websocket connection established");
    } catch (error) {
      t.fail("app websocket connection should have been established");
    }
  })
);

test(
  "app websocket connection from disallowed origin is rejected",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin, installed_app_id } = await installAppAndDna(ADMIN_PORT);
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
      t.fail("app websocket connection should have failed");
    } catch (error) {
      t.assert(error instanceof HolochainError, "expected a HolochainError");
      t.pass("app websocket connection failed as expected");
    }
  })
);

test(
  "client errors are HolochainErrors",
  withConductor(ADMIN_PORT, async (t) => {
    const { cell_id, client, admin } = await installAppAndDna(ADMIN_PORT);
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
      t.fail("This zome call should have thrown an error.");
    } catch (error) {
      t.ok(
        error instanceof HolochainError,
        "error is an instance of HolochainError"
      );
      assert(error instanceof HolochainError);
      t.equal(error.name, "internal_error", "error has correct name");
    }
  })
);

test(
  "can install app with roles_settings",
  withConductor(ADMIN_PORT, async (t) => {
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: ADMIN_WS_URL,
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
    t.equal(provisionedCell.dna_modifiers.network_seed, "hello");
    t.deepEqual(
      yaml.load(decode(provisionedCell.dna_modifiers.properties) as string),
      { progenitor: progenitorKey }
    );
  })
);

test(
  "memproofs can be provided after app installation",
  withConductor(ADMIN_PORT, async (t) => {
    const role_name = "foo";
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: ADMIN_WS_URL,
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin.generateAgentPubKey();

    const zippedDnaBundle = fs.readFileSync("test/e2e/fixture/test.dna");

    const appBundle: AppBundle = {
      manifest: {
        manifest_version: "1",
        name: "app",
        roles: [
          {
            name: role_name,
            provisioning: {
              strategy: CellProvisioningStrategy.Create,
              deferred: false,
            },
            dna: {
              bundled: "dna_1",
              modifiers: { network_seed: "some_seed" },
            },
          },
        ],
        membrane_proofs_deferred: true,
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
    t.deepEqual(
      appInfo.status,
      { type: "disabled", value: { reason: { type: "never_started" } } },
      "app is in status awaiting_memproofs"
    );

    try {
      await client.enableApp();
      t.fail("enabling app should fail while memproofs not provided");
    } catch (error) {
      t.equal(
        error.message,
        "Other: app not in correct state to enable",
        "enabling app fails while memproofs not provided"
      );
    }

    const response = await client.provideMemproofs({});
    t.equal(response, undefined, "memproofs provided successfully");

    appInfo = await client.appInfo();
    t.deepEqual(
      appInfo.status,
      {
        type: "disabled",
        value: { reason: { type: "not_started_after_providing_memproofs" } },
      },
      "app is disabled after providing memproofs"
    );

    await client.enableApp();
    appInfo = await client.appInfo();
    t.deepEqual(appInfo.status, { type: "running" }, "app is running");
  })
);

test(
  "generated signing key has same location bytes as original agent pub key",
  withConductor(ADMIN_PORT, async (t) => {
    const admin = await AdminWebsocket.connect({
      url: ADMIN_WS_URL,
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin.generateAgentPubKey();
    const [, signingKey] = await generateSigningKeyPair(agent);
    t.deepEqual(signingKey.subarray(35), Uint8Array.from(agent.subarray(35)));
  })
);

test(
  "install app from bytes",
  withConductor(ADMIN_PORT, async (t) => {
    const role_name = "foo";
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: ADMIN_WS_URL,
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
    t.equal(response, "foo", "zome call succeeds");
  })
);

test(
  "stateDump",
  withConductor(ADMIN_PORT, async (t) => {
    const { cell_id, client, admin } = await installAppAndDna(ADMIN_PORT);
    const info = await client.appInfo();
    assert(info);
    assert(info.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    t.deepEqual(info.cell_info[ROLE_NAME][0].value.cell_id, cell_id);
    t.ok(ROLE_NAME in info.cell_info);
    t.deepEqual(info.status, { type: "running" });
    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };

    await admin.authorizeSigningCredentials(cell_id);

    const response = await client.callZome(zomeCallPayload);
    t.equal(response, "foo");

    const state: DumpStateResponse = await admin.dumpState({
      cell_id: (info.cell_info[ROLE_NAME][0].value as ProvisionedCell).cell_id,
    });
    t.equal(state[0].source_chain_dump.records.length, 5);
    t.equal(state[0].source_chain_dump.records[0].action.type, "Dna");
  })
);

test(
  "fullStateDump with ChainOps",
  withConductor(ADMIN_PORT, async (t) => {
    const { cell_id, admin } = await installAppAndDna(ADMIN_PORT);
    const state: FullStateDump = await admin.dumpFullState({
      cell_id,
    });
    for (const dhtOp of state.integration_dump.integrated) {
      t.assert("ChainOp" in dhtOp, "dht op is a chain op");
    }
  })
);

test(
  "can receive a signal using event handler",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin, cell_id, client } = await installAppAndDna(ADMIN_PORT);
    let resolveSignalPromise: (value?: unknown) => void | undefined;
    const signalReceivedPromise = new Promise(
      (resolve) => (resolveSignalPromise = resolve)
    );
    const signalCb = (signal: Signal) => {
      assert(signal.type === SignalType.App);
      t.deepEqual(signal.value, {
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
  })
);

// test without conductor
test("error is catchable when holochain socket is unavailable", async (t) => {
  try {
    await AdminWebsocket.connect({ url: ADMIN_WS_URL });
    t.fail("websocket connection should have failed");
  } catch (e) {
    t.assert(e instanceof HolochainError, "expected a HolochainError");
    t.pass("websocket connection failed as expected");
  }

  try {
    await AppWebsocket.connect({ url: ADMIN_WS_URL });
    t.fail("websocket connection should have failed");
  } catch (e) {
    t.assert(e instanceof HolochainError, "expected a HolochainError");
    t.pass("websocket connection failed as expected");
  }
});

test(
  "zome call timeout can be overridden",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
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
      t.fail("zome call did not time out");
    } catch (error) {
      t.pass("zome call timed out");
    }
  })
);

test("can inject agents", async (t) => {
  const localServices = await runLocalServices();
  const conductor1 = await launch(
    ADMIN_PORT,
    localServices.bootstrapServerUrl,
    localServices.signalingServerUrl
  );
  const installed_app_id = "app";
  const admin1 = await AdminWebsocket.connect({
    url: ADMIN_WS_URL,
    wsClientOptions: { origin: "client-test-admin" },
  });

  // There shouldn't be any agent infos yet.
  let agentInfos1 = await admin1.agentInfo({ cell_id: null });
  t.assert(agentInfos1.length === 0);

  const agent1 = await admin1.generateAgentPubKey();
  const result = await admin1.installApp({
    source: {
      type: "path",
      value: `${FIXTURE_PATH}/test.happ`,
    },
    installed_app_id,
    agent_key: agent1,
  });
  t.ok(result);
  assert(result.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
  const app1_cell = result.cell_info[ROLE_NAME][0].value.cell_id;
  const activeApp1Info = await admin1.enableApp({ installed_app_id }, 1000);
  t.deepEqual(activeApp1Info.app.status, { type: "running" });
  t.ok(ROLE_NAME in activeApp1Info.app.cell_info);
  t.equal(activeApp1Info.app.installed_app_id, installed_app_id);
  t.equal(activeApp1Info.errors.length, 0);

  // There should be one agent info now.
  agentInfos1 = await admin1.agentInfo({ cell_id: null });
  t.assert(agentInfos1.length === 1);

  // Now confirm that we can ask for just one cell.
  let cellAgentInfos = await admin1.agentInfo({
    cell_id: [await fakeDnaHash(), fakeAgentPubKey()],
  });
  t.assert(cellAgentInfos.length === 0);
  cellAgentInfos = await admin1.agentInfo({
    cell_id: app1_cell,
  });
  t.deepEqual(cellAgentInfos, agentInfos1);

  const conductor2 = await launch(
    ADMIN_PORT_1,
    localServices.bootstrapServerUrl,
    localServices.signalingServerUrl
  );
  const admin2 = await AdminWebsocket.connect({
    url: new URL(`ws://localhost:${ADMIN_PORT_1}`),
    wsClientOptions: { origin: "client-test-admin" },
  });

  let agentInfos2 = await admin2.agentInfo({ cell_id: null });
  t.assert(agentInfos2.length === 0);

  await admin2.addAgentInfo({ agent_infos: agentInfos1 });
  agentInfos2 = await admin2.agentInfo({ cell_id: null });
  t.assert(
    agentInfos2.length === 1,
    "number of agent infos on conductor 2 is 1"
  );

  await stopLocalServices(localServices.servicesProcess);
  if (conductor1.pid) {
    process.kill(-conductor1.pid);
  }
  if (conductor2.pid) {
    process.kill(-conductor2.pid);
  }
  await cleanSandboxConductors();
});

test("can query agent meta info over admin and app websocket", async (t) => {
  const localServices = await runLocalServices();
  const conductor1 = await launch(
    ADMIN_PORT,
    localServices.bootstrapServerUrl,
    localServices.signalingServerUrl
  );
  const {
    cell_id: cell_id1,
    client: appClient1,
    admin: admin1,
  } = await createAppWsAndInstallApp(ADMIN_PORT);

  await admin1.authorizeSigningCredentials(cell_id1);

  // Retrieve the peer URL of the agent
  const agentInfos1 = await admin1.agentInfo({ cell_id: null });
  const agentInfo1 = JSON.parse(agentInfos1[0]).agentInfo;
  const agentUrl1 = JSON.parse(agentInfo1).url;
  console.log("agentUrl1: ", agentUrl1);

  // Start a second conductor and install the same app
  const conductor2 = await launch(
    ADMIN_PORT_1,
    localServices.bootstrapServerUrl,
    localServices.signalingServerUrl
  );

  const {
    cell_id: cell_id2,
    client: appClient2,
    admin: admin2,
  } = await createAppWsAndInstallApp(ADMIN_PORT_1);

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
    20_000
  );

  // Now have agent 2 get peer meta info for agent 1 via the admin websocket
  const agentMetaInfos = await admin2.agentMetaInfo({ url: agentUrl1 });

  // Check that it contains gossip meta info
  const metaInfosForDna = agentMetaInfos[encodeHashToBase64(cell_id2[0])];
  t.assert(metaInfosForDna);
  t.assert(metaInfosForDna["gossip:completed_rounds"].meta_value);
  t.assert(metaInfosForDna["gossip:completed_rounds"].expires_at);
  t.assert(metaInfosForDna["gossip:last_timestamp"].meta_value);
  t.assert(metaInfosForDna["gossip:last_timestamp"].expires_at);

  // Now have agent 2 get peer meta info for agent 1 via the app websocket
  const agentMetaInfosApp = await appClient2.agentMetaInfo({ url: agentUrl1 });

  // Check that it contains gossip meta info
  const metaInfosForDnaApp = agentMetaInfosApp[encodeHashToBase64(cell_id2[0])];
  t.assert(metaInfosForDnaApp);
  t.assert(metaInfosForDnaApp["gossip:completed_rounds"].meta_value);
  t.assert(metaInfosForDnaApp["gossip:completed_rounds"].expires_at);
  t.assert(metaInfosForDnaApp["gossip:last_timestamp"].meta_value);
  t.assert(metaInfosForDnaApp["gossip:last_timestamp"].expires_at);

  await stopLocalServices(localServices.servicesProcess);
  if (conductor1.pid) {
    process.kill(-conductor1.pid);
  }
  if (conductor2.pid) {
    process.kill(-conductor2.pid);
  }
  await cleanSandboxConductors();
});

test(
  "can query agents over app ws",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    // There should be one agent info.
    const agentInfos = await client.agentInfo({ dna_hashes: null });
    t.assert(agentInfos.length === 1, "number of agent infos of app is 1");

    const agentInfosForFakeDna = await client.agentInfo({
      dna_hashes: [await fakeDnaHash()],
    });
    t.assert(
      agentInfosForFakeDna.length === 0,
      "number of agent infos for fake DNA is 0"
    );

    const appInfo = await client.appInfo();
    const cell = appInfo.cell_info[ROLE_NAME][0];
    assert(cell.type === CellType.Provisioned);
    const dnaHash = cell.value.cell_id[0];
    const agentInfosForDna = await client.agentInfo({
      dna_hashes: [dnaHash],
    });
    t.assert(
      agentInfosForDna.length === 1,
      "number of agent infos for app's DNA is 1"
    );
    t.deepEqual(agentInfos, agentInfosForDna);
  })
);

test(
  "create link",
  withConductor(ADMIN_PORT, async (t) => {
    const { cell_id, client, admin } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const tag = "test_tag";
    const link: Link = await client.callZome({
      cell_id,
      provenance: cell_id[1],
      zome_name: TEST_ZOME_NAME,
      fn_name: "create_and_get_link",
      payload: Array.from(Buffer.from(tag)),
    });

    t.deepEqual(link.author, cell_id[1], "link author is correct");
    t.deepEqual(
      Array.from(link.create_link_hash.subarray(0, 3)),
      [132, 41, 36],
      "create link hash is valid"
    );
    t.deepEqual(link.link_type, 0, "link type is correct");
    t.deepEqual(link.zome_index, 0, "zome index is correct");
    t.ok("BYTES_PER_ELEMENT" in link.tag, "tag is a byte array");
    t.deepEqual(link.tag.toString(), tag, "tag is correct");
  })
);

test(
  "create and delete link",
  withConductor(ADMIN_PORT, async (t) => {
    const { cell_id, client, admin } = await installAppAndDna(ADMIN_PORT);
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
    t.equal(
      lastAction.action.hashed.content.type,
      ActionType.DeleteLink,
      "last action is DeleteLink"
    );
    const secondLastAction = activity[1];
    t.equal(
      secondLastAction.action.hashed.content.type,
      ActionType.CreateLink,
      "second last action is CreateLink"
    );
    assert(
      secondLastAction.action.hashed.content.type === ActionType.CreateLink
    );
    t.equal(
      secondLastAction.action.hashed.content.link_type,
      0,
      "link type is 0"
    );
  })
);

test(
  "admin smoke test: listAppInterfaces + attachAppInterface",
  withConductor(ADMIN_PORT, async (t) => {
    const admin = await AdminWebsocket.connect({
      url: ADMIN_WS_URL,
      wsClientOptions: { origin: "client-test-admin" },
    });

    let interfaces = await admin.listAppInterfaces();
    t.equal(interfaces.length, 0);

    await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });

    interfaces = await admin.listAppInterfaces();
    t.equal(interfaces.length, 1);
    t.true(interfaces[0].port > 0);
    t.equal(interfaces[0].allowed_origins, "client-test-app");
    t.equal(interfaces[0].installed_app_id, null);
  })
);

test(
  "can use some of the defined js bindings",
  withConductor(ADMIN_PORT, async (t) => {
    const { installed_app_id, cell_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    let info = await client.appInfo(1000);
    assert(info);
    assert(info.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    t.deepEqual(info.cell_info[ROLE_NAME][0].value.cell_id, cell_id);
    t.ok(ROLE_NAME in info.cell_info);
    t.deepEqual(info.status, { type: "running" });
    await admin.authorizeSigningCredentials(cell_id);
    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    const response = await client.callZome(zomeCallPayload, 30000);
    t.equal(response, "foo");

    await admin.disableApp({ installed_app_id });
    info = await client.appInfo(1000);
    assert(info);
    t.deepEqual(info.status, {
      type: "disabled",
      value: { reason: { type: "user" } },
    });
  })
);

test(
  "admin smoke test: install 2 hApp bundles with different network seeds",
  withConductor(ADMIN_PORT, async (t) => {
    const admin = await AdminWebsocket.connect({
      url: ADMIN_WS_URL,
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
    t.isNotDeepEqual(
      installedApp1.cell_info[ROLE_NAME][0].value.cell_id[0],
      installedApp2.cell_info[ROLE_NAME][0].value.cell_id[0]
    );
  })
);

test(
  "can create a callable clone cell",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin } = await installAppAndDna(ADMIN_PORT);
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
    t.equal(cloneCell.clone_id, expectedCloneId, "correct clone id");
    assert(appInfo.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    t.deepEqual(
      cloneCell.cell_id[1],
      appInfo.cell_info[ROLE_NAME][0].value.cell_id[1],
      "clone cell agent key matches base cell agent key"
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
    t.equal(
      response,
      "foo",
      "clone cell can be called with same zome call as base cell"
    );
  })
);

test(
  "can disable a clone cell",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin } = await installAppAndDna(ADMIN_PORT);
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
    t.equal(
      appInfo.cell_info[ROLE_NAME].length,
      2,
      "disabled clone cell is still part of app info"
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
      t.fail();
    } catch (error) {
      t.pass("disabled clone call cannot be called");
    }
  })
);

test(
  "can enable a disabled clone cell",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin } = await installAppAndDna(ADMIN_PORT);
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
    t.equal(
      appInfo.cell_info[ROLE_NAME].length,
      2,
      "clone cell is part of app info"
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
    t.equal(response, "foo", "enabled clone cell can be called");
  })
);

test(
  "can delete archived clone cells of an app",
  withConductor(ADMIN_PORT, async (t) => {
    const { installed_app_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
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
      t.fail();
    } catch (error) {
      t.pass("deleted clone cell cannot be enabled");
    }
  })
);

test(
  "requests get canceled if the websocket closes while waiting for a response",
  withConductor(ADMIN_PORT, async (t) => {
    const { cell_id, client, admin } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const call1 = client.callZome(
      {
        cell_id,
        zome_name: TEST_ZOME_NAME,
        fn_name: "waste_some_time",
        provenance: cell_id[1],
        payload: null,
      },
      1000
    );
    const call2 = client.callZome(
      {
        cell_id,
        zome_name: TEST_ZOME_NAME,
        fn_name: "waste_some_time",
        provenance: cell_id[1],
        payload: null,
      },
      1000
    );

    await delay(100);

    const closeEventCode = 1000;
    await client.client.close(closeEventCode);
    t.ok(
      client.client.socket.readyState !== client.client.socket.OPEN,
      "ws is not open"
    );

    const [res1, res2] = await Promise.allSettled([call1, call2]);
    assert(res1.status === "rejected");
    t.assert(res1.reason instanceof HolochainError, "res1 is a HolochainError");
    t.equal(
      res1.reason.name,
      "ClientClosedWithPendingRequests",
      "res1 is correct holochain error"
    );
    assert(res2.status === "rejected");
    t.equal(
      res2.reason.name,
      "ClientClosedWithPendingRequests",
      "res1 is correct holochain error"
    );
  })
);

test(
  "can fetch storage info",
  withConductor(ADMIN_PORT, async (t) => {
    const { installed_app_id, admin } = await installAppAndDna(ADMIN_PORT);

    const response = await admin.storageInfo();

    t.equal(response.blobs.length, 1);
    t.assert(
      response.blobs.some((blob) =>
        blob.value.used_by.includes(installed_app_id)
      )
    );
  })
);

test(
  "can dump network stats",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin, client } = await installAppAndDna(ADMIN_PORT);

    const response = await admin.dumpNetworkStats();

    t.assert(response.backend, "BackendLibDataChannel");
    t.assert(response.peer_urls.length === 1);
    const peerUrl = new URL(response.peer_urls[0]);
    t.assert(peerUrl.origin, "wss://dev-test-bootstrap2.holochain.org");
    t.deepEqual(response.connections, []);

    const appWsResponse = await client.dumpNetworkStats();
    t.deepEqual(appWsResponse, response);
  })
);

test(
  "can dump network metrics",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin, cell_id, client } = await installAppAndDna(ADMIN_PORT);

    // Call it without dna_hash field
    const response = await admin.dumpNetworkMetrics({
      include_dht_summary: true,
    });
    const dnaHash = encodeHashToBase64(cell_id[0]);
    t.assert(response[dnaHash], "expected entry in map under dna hash");
    t.deepEqual(response[dnaHash].fetch_state_summary.pending_requests, {});
    t.deepEqual(response[dnaHash].fetch_state_summary.peers_on_backoff, {});
    t.deepEqual(response[dnaHash].gossip_state_summary.accepted_rounds, []);
    t.deepEqual(response[dnaHash].gossip_state_summary.initiated_round, null);
    t.deepEqual(response[dnaHash].gossip_state_summary.peer_meta, {});
    t.deepEqual(response[dnaHash].local_agents, [
      { agent: cell_id[1], storage_arc: null, target_arc: [0, 4294967295] },
    ]);

    // call it with dna_hash field
    const response2 = await admin.dumpNetworkMetrics({
      dna_hash: cell_id[0],
      include_dht_summary: true,
    });

    t.deepEqual(response, response2);

    // call it on the app websocket as well, the response should be identical
    const appWsResponse = await client.dumpNetworkMetrics({
      include_dht_summary: true,
    });
    t.deepEqual(appWsResponse, response);

    // call it with dna_hash field
    const appWsResponse2 = await client.dumpNetworkMetrics({
      dna_hash: cell_id[0],
      include_dht_summary: true,
    });
    t.deepEqual(appWsResponse2, response);
  })
);

test(
  "can update coordinators of an app",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    try {
      await client.callZome({
        cell_id,
        zome_name: "coordinator2",
        fn_name: "echo_hi",
        provenance: cell_id[1],
        payload: null,
      });
      t.fail();
    } catch (error) {
      t.pass("coordinator2 zome does not exist yet");
    }

    const bundle = await makeCoordinatorZomeBundle();

    await admin.updateCoordinators({
      dna_hash: cell_id[0],
      source: {
        type: "bundle",
        value: bundle,
      },
    });

    const dnaDef = await admin.getDnaDefinition(cell_id[0]);
    const zomeNames = dnaDef.coordinator_zomes.map((x) => x[0]);

    t.ok(
      zomeNames.includes("coordinator2"),
      "coordinator zomes can be updated"
    );

    const response = await client.callZome({
      cell_id,
      zome_name: "coordinator2",
      fn_name: "echo_hi",
      provenance: cell_id[1],
      payload: null,
    });

    t.equal(response, "hi", "updated coordinator zomes can be called");
  })
);

test(
  "client reconnects websocket if closed before making a zome call",
  withConductor(ADMIN_PORT, async (t) => {
    const { cell_id, client, admin } = await installAppAndDna(
      ADMIN_PORT,
      false,
      0
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
      t.pass("websocket was reconnected successfully");
    } catch (error) {
      t.fail(`websocket was not reconnected: ${error}`);
    }
  })
);

test(
  "client fails to reconnect to websocket if closed before making a zome call if the provided token is invalid",
  withConductor(ADMIN_PORT, async (t) => {
    const { cell_id, client, admin } = await installAppAndDna(ADMIN_PORT);
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
      t.fail(
        "reconnecting to websocket should have failed due to an invalid token."
      );
    } catch (error) {
      t.assert(
        error instanceof HolochainError,
        "error should be of type HolochainError"
      );
      assert(error instanceof HolochainError);
      t.equal(error.name, "InvalidTokenError", "expected an InvalidTokenError");
    }

    // Websocket reconnection has failed and subsequent calls should just return a websocket
    // closed error.
    try {
      await client.callZome(callParams);
      t.fail("should not be attempted to reconnect websocket");
    } catch (error) {
      t.assert(
        error instanceof HolochainError,
        "error should be of type HolochainError"
      );
      assert(error instanceof HolochainError);
      t.equal(
        error.name,
        "WebsocketClosedError",
        "expected a WebsocketClosedError"
      );
    }
  })
);

test(
  "Rust enums are serialized correctly",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const serializationEnumInputVariant = "Input";
    const response = await client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "enum_serialization",
      provenance: cell_id[1],
      payload: serializationEnumInputVariant,
    });
    t.deepEqual(response, { Output: "success" });
  })
);

test(
  "Agent key can be revoked",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin, cell_id, client, installed_app_id } = await installAppAndDna(
      ADMIN_PORT
    );
    await admin.authorizeSigningCredentials(cell_id);

    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "create_an_entry",
      provenance: cell_id[1],
      payload: null,
    };
    let response = await client.callZome(zomeCallPayload);
    t.ok(response, "zome call succeeds");

    response = await admin.revokeAgentKey({
      app_id: installed_app_id,
      agent_key: cell_id[1],
    });
    t.deepEqual(response, []);

    try {
      response = await client.callZome(zomeCallPayload);
      console.log("response", response);
      t.fail("create entry must no be possible after revoking agent key");
    } catch (error) {
      t.assert(error instanceof HolochainError);
      t.pass("create entry must no be possible after revoking agent key");
    }
  })
);
