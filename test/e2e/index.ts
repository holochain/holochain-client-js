import { decode } from "@msgpack/msgpack";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "tape";
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
  CellType,
  CloneId,
  CreateCloneCellRequest,
  DnaBundle,
  DumpStateResponse,
  EnableAppResponse,
  FullStateDump,
  HolochainError,
  InstalledAppInfoStatus,
  Link,
  RegisterAgentActivity,
  RoleName,
  encodeHashToBase64,
  generateSigningKeyPair,
  SignalType,
  Signal,
  isSameCell,
} from "../../src";
import {
  FIXTURE_PATH,
  cleanSandboxConductors,
  installAppAndDna,
  launch,
  makeCoordinatorZomeBundle,
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
      modifiers: {},
      path,
    });
    t.ok(hash, "dna registered");

    const installedApp = await admin.installApp({
      installed_app_id,
      agent_key,
      path: `${FIXTURE_PATH}/test.happ`,
      membrane_proofs: {},
    });
    const status: InstalledAppInfoStatus = installedApp.status;
    t.deepEqual(
      status,
      { disabled: { reason: "never_started" } },
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
      {
        disabled: { reason: "never_started" },
      },
      "disabled app never started"
    );

    const pausedAppsInfo = await admin.listApps({
      status_filter: AppStatusFilter.Paused,
    });
    t.equal(pausedAppsInfo.length, 0, "0 paused apps");

    const { app, errors } = await admin.enableApp({ installed_app_id });
    t.deepEqual(app.status, "running");
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
    t.deepEqual(runningAppsInfo2[0].status, "running");

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
      disabled: { reason: "user" },
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
      hash,
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
      path,
      agent_key,
      installed_app_id,
      membrane_proofs: {},
    });
    t.ok(installedApp);
    t.deepEqual(installedApp.status, {
      disabled: { reason: "never_started" },
    });

    const runningApps1 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(runningApps1.length, 0);

    const enabledAppInfo = await admin.enableApp({ installed_app_id });
    t.deepEqual(enabledAppInfo.app.status, "running");
    t.equal(enabledAppInfo.app.installed_app_id, installed_app_id);
    t.equal(enabledAppInfo.errors.length, 0);

    const runningApps2 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(runningApps2.length, 1);
    t.equal(runningApps2[0].installed_app_id, installed_app_id);

    const cellIds = await admin.listCellIds();
    t.equal(cellIds.length, 1);
    assert(CellType.Provisioned in installedApp.cell_info[ROLE_NAME][0]);
    t.assert(
      cellIds.some((cellId) =>
        isSameCell(
          cellId,
          installedApp.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id
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
      modifiers: {},
      bundle: dnaBundle,
    });
    t.ok(hash);

    await admin.installApp({
      installed_app_id,
      agent_key,
      path: `${FIXTURE_PATH}/test.happ`,
      membrane_proofs: {},
    });

    const dnaDefinition = await admin.getDnaDefinition(hash);
    t.equal(dnaDefinition.name, "test-dna", "dna definition: name matches");
    t.equal(
      dnaDefinition.modifiers.network_seed,
      "9a28aac8-337c-11eb-adc1-0Z02acw20115",
      "dna definition: network seed matches"
    );
    t.equal(
      Math.floor(dnaDefinition.modifiers.origin_time / 1000),
      new Date("2022-02-11T23:05:19.470323Z").getTime(),
      "dna definition: origin time matches"
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
    t.deepEqual(enabledAppInfo.app.status, "running");
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
      CellType.Provisioned in info.cell_info[ROLE_NAME][0],
      "got expected cell"
    );
    t.deepEqual(
      info.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id,
      cell_id,
      "got correct cell id"
    );
    t.ok(ROLE_NAME in info.cell_info, "role name correct");
    t.deepEqual(info.status, "running", "status is running");

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
      { disabled: { reason: "user" } },
      "disabled reason user"
    );
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
    assert(CellType.Provisioned in info.cell_info[ROLE_NAME][0]);

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
    } catch (error) {
      t.ok(
        error instanceof HolochainError,
        "error is an instance of HolochainError"
      );
      assert(error instanceof HolochainError);
      t.equal(error.name, "ribosome_error", "error has correct name");
    }
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

    await admin.installApp({
      installed_app_id,
      agent_key: agent,
      bundle: {
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
                path: fs.realpathSync("test/e2e/fixture/test.dna"),
                modifiers: { network_seed: "some_seed" },
              },
            },
          ],
          membrane_proofs_deferred: true,
        },
        resources: {},
      },
      membrane_proofs: {},
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
      { disabled: { reason: "never_started" } },
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
      { disabled: { reason: "not_started_after_providing_memproofs" } },
      "app is disabled after providing memproofs"
    );

    await client.enableApp();
    appInfo = await client.appInfo();
    t.deepEqual(appInfo.status, "running", "app is running");

    appInfo = await client.appInfo();
    t.equal(appInfo.status, "running", "app is in status running");
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
  "install app with app manifest from path",
  withConductor(ADMIN_PORT, async (t) => {
    const role_name = "foo";
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: ADMIN_WS_URL,
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin.generateAgentPubKey();

    const app = await admin.installApp({
      installed_app_id,
      agent_key: agent,
      bundle: {
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
                path: fs.realpathSync("test/e2e/fixture/test.dna"),
                modifiers: { quantum_time: { secs: 1111, nanos: 1111 } },
              },
            },
          ],
          membrane_proofs_deferred: false,
        },
        resources: {},
      },
      membrane_proofs: {},
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

    assert(CellType.Provisioned in app.cell_info[role_name][0]);
    const cell_id = app.cell_info[role_name][0][CellType.Provisioned].cell_id;

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
  "install app with app manifest and resource map",
  withConductor(ADMIN_PORT, async (t) => {
    const role_name = "foo";
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect({
      url: ADMIN_WS_URL,
      wsClientOptions: { origin: "client-test-admin" },
    });
    const agent = await admin.generateAgentPubKey();

    const dnaPath = `${FIXTURE_PATH}/test.dna`;
    const zippedDnaBundle = fs.readFileSync(dnaPath);
    const app = await admin.installApp({
      installed_app_id,
      agent_key: agent,
      bundle: {
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
                modifiers: { quantum_time: { secs: 1111, nanos: 1111 } },
              },
            },
          ],
          membrane_proofs_deferred: false,
        },
        resources: {
          dna_1: zippedDnaBundle,
        },
      },
      membrane_proofs: {},
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

    assert(CellType.Provisioned in app.cell_info[role_name][0]);
    const cell_id = app.cell_info[role_name][0][CellType.Provisioned].cell_id;

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
  "get compatible cells of a cell",
  withConductor(ADMIN_PORT, async (t) => {
    const { installed_app_id, cell_id, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    const dnaHashB64 = encodeHashToBase64(cell_id[0]);
    const a = await admin.getCompatibleCells(dnaHashB64);
    const compatibleCells = a.values();
    const compatibleCell_1 = compatibleCells.next();
    t.deepEqual(
      compatibleCell_1.value,
      [installed_app_id, [cell_id]],
      "compatible cells contains tuple of installed app id and cell id"
    );
    const next = compatibleCells.next();
    t.equal(next.value, undefined, "no other value in set");
    t.assert(next.done);
  })
);

test(
  "stateDump",
  withConductor(ADMIN_PORT, async (t) => {
    const { cell_id, client, admin } = await installAppAndDna(ADMIN_PORT);
    const info = await client.appInfo();
    assert(info);
    assert(CellType.Provisioned in info.cell_info[ROLE_NAME][0]);
    t.deepEqual(
      info.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id,
      cell_id
    );
    t.ok(ROLE_NAME in info.cell_info);
    t.deepEqual(info.status, "running");
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
      cell_id: info.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id,
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
      assert(SignalType.App in signal);
      t.deepEqual(signal[SignalType.App], {
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
  const conductor1 = await launch(ADMIN_PORT);
  const conductor2 = await launch(ADMIN_PORT_1);
  const installed_app_id = "app";
  const admin1 = await AdminWebsocket.connect({
    url: ADMIN_WS_URL,
    wsClientOptions: { origin: "client-test-admin" },
  });
  const admin2 = await AdminWebsocket.connect({
    url: new URL(`ws://localhost:${ADMIN_PORT_1}`),
    wsClientOptions: { origin: "client-test-admin" },
  });
  const agent_key_1 = await admin1.generateAgentPubKey();
  t.ok(agent_key_1);
  const agent_key_2 = await admin2.generateAgentPubKey();
  t.ok(agent_key_2);
  const path = `${FIXTURE_PATH}/test.dna`;
  let result = await admin1.installApp({
    installed_app_id,
    agent_key: agent_key_1,
    membrane_proofs: {},
    path: `${FIXTURE_PATH}/test.happ`,
  });
  t.ok(result);
  assert(CellType.Provisioned in result.cell_info[ROLE_NAME][0]);
  const app1_cell =
    result.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id;
  const activeApp1Info = await admin1.enableApp({ installed_app_id }, 1000);
  t.deepEqual(activeApp1Info.app.status, "running");
  t.ok(ROLE_NAME in activeApp1Info.app.cell_info);
  t.equal(activeApp1Info.app.installed_app_id, installed_app_id);
  t.equal(activeApp1Info.errors.length, 0);

  const conductor1_agentInfo = await admin1.agentInfo({
    cell_id: null,
  });
  // one app agent
  // and one DPKI agent once DPKI is enabled again
  t.equal(conductor1_agentInfo.length, 1);

  // with no activated apps there is no agent
  // only the DPKI agent
  let conductor2_agentInfo = await admin2.agentInfo({ cell_id: null });
  t.equal(conductor2_agentInfo.length, 0);

  // but, after explicitly injecting an agent, we should see it too
  await admin2.addAgentInfo({ agent_infos: [conductor1_agentInfo[0]] });
  conductor2_agentInfo = await admin2.agentInfo({ cell_id: null });
  t.equal(conductor2_agentInfo.length, 1);

  // now install the app and activate it on agent 2.
  await admin2.registerDna({
    modifiers: {},
    path,
  });
  result = await admin2.installApp({
    installed_app_id,
    agent_key: agent_key_2,
    membrane_proofs: {},
    path: `${FIXTURE_PATH}/test.happ`,
  });
  t.ok(result);
  assert(CellType.Provisioned in result.cell_info[ROLE_NAME][0]);
  const app2_cell =
    result.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id;
  const activeApp2Info = await admin2.enableApp({ installed_app_id });
  t.deepEqual(activeApp2Info.app.status, "running");
  t.ok(ROLE_NAME in activeApp2Info.app.cell_info);
  t.equal(activeApp2Info.app.installed_app_id, installed_app_id);
  t.equal(activeApp2Info.errors.length, 0);

  // observe 2 agent infos
  conductor2_agentInfo = await admin2.agentInfo({ cell_id: null });
  t.equal(conductor2_agentInfo.length, 2);

  // now confirm that we can ask for just one cell
  await admin1.addAgentInfo({ agent_infos: conductor2_agentInfo });
  const app1_agentInfo = await admin1.agentInfo({
    cell_id: app1_cell,
  });
  t.equal(app1_agentInfo.length, 1);
  const app2_agentInfo = await admin2.agentInfo({
    cell_id: app2_cell,
  });
  t.equal(app2_agentInfo.length, 1);

  if (conductor1.pid) {
    process.kill(-conductor1.pid);
  }
  if (conductor2.pid) {
    process.kill(-conductor2.pid);
  }
  await cleanSandboxConductors();
});

test(
  "create link",
  withConductor(ADMIN_PORT, async (t) => {
    const { cell_id, client, admin } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const tag = "test_tag";
    const link: Link = await client.callZome({
      cap_secret: null,
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
      cap_secret: null,
      cell_id,
      provenance: cell_id[1],
      zome_name: TEST_ZOME_NAME,
      fn_name: "create_and_delete_link",
      payload: null,
    });
    const activity: RegisterAgentActivity[] = await client.callZome({
      cap_secret: null,
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
    assert(CellType.Provisioned in info.cell_info[ROLE_NAME][0]);
    t.deepEqual(
      info.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id,
      cell_id
    );
    t.ok(ROLE_NAME in info.cell_info);
    t.deepEqual(info.status, "running");
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
    t.deepEqual(info.status, { disabled: { reason: "user" } });
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
      agent_key,
      installed_app_id: "test-app1",
      membrane_proofs: {},
      path: `${FIXTURE_PATH}/test.happ`,
      network_seed: "1",
    });
    const installedApp2 = await admin.installApp({
      agent_key,
      installed_app_id: "test-app2",
      membrane_proofs: {},
      path: `${FIXTURE_PATH}/test.happ`,
      network_seed: "2",
    });

    assert(CellType.Provisioned in installedApp1.cell_info[ROLE_NAME][0]);
    assert(CellType.Provisioned in installedApp2.cell_info[ROLE_NAME][0]);
    t.isNotDeepEqual(
      installedApp1.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id[0],
      installedApp2.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id[0]
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

    const expectedCloneId = new CloneId(ROLE_NAME, 0).toString();
    t.equal(cloneCell.clone_id, expectedCloneId, "correct clone id");
    assert(CellType.Provisioned in appInfo.cell_info[ROLE_NAME][0]);
    t.deepEqual(
      cloneCell.cell_id[1],
      appInfo.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id[1],
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
      clone_cell_id: cloneCell.cell_id[0],
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
      clone_cell_id: cloneCell.cell_id[0],
    });

    const enabledCloneCell = await client.enableCloneCell({
      clone_cell_id: CloneId.fromRoleName(cloneCell.clone_id).toString(),
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
      clone_cell_id: cloneCell.cell_id[0],
    });

    await admin.deleteCloneCell({
      app_id: installed_app_id,
      clone_cell_id: cloneCell.cell_id[0],
    });

    try {
      await client.enableCloneCell({
        clone_cell_id: cloneCell.cell_id[0],
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
      response.blobs.some((blob) => blob.dna.used_by.includes(installed_app_id))
    );
  })
);

test(
  "can fetch network stats",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin } = await installAppAndDna(ADMIN_PORT);

    const response = await admin.dumpNetworkStats();

    t.ok(typeof response === "string", "response is string");
    t.ok(JSON.parse(response), "response is valid JSON");
  })
);

test(
  "can fetch network info",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, cell_id } = await installAppAndDna(ADMIN_PORT);

    const response = await client.networkInfo({
      dnas: [cell_id[0]],
    });

    t.deepEqual(response, [
      {
        fetch_pool_info: { op_bytes_to_fetch: 0, num_ops_to_fetch: 0 },
        current_number_of_peers: 1,
        arc_size: 1,
        total_network_peers: 1,
        bytes_since_last_time_queried: 1838,
        completed_rounds_since_last_time_queried: 0,
      },
    ]);
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
      bundle,
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
