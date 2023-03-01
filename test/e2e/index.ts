import { decode } from "@msgpack/msgpack";
import assert from "node:assert/strict";
import fs from "node:fs";
import test, { Test } from "tape";
import zlib from "zlib";
import {
  AdminWebsocket,
  AppEntryDef,
  AppSignal,
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
  InstalledAppInfoStatus,
  RoleName,
} from "../../src/index.js";
import {
  cleanSandboxConductors,
  FIXTURE_PATH,
  installAppAndDna,
  launch,
  withConductor,
} from "./util.js";

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

test(
  "admin smoke test: registerDna + installApp + uninstallApp",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect(
      `ws://127.0.0.1:${ADMIN_PORT}`,
      12000
    );

    const agent_key = await admin.generateAgentPubKey();
    t.ok(agent_key);

    const path = `${FIXTURE_PATH}/test.dna`;
    const hash = await admin.registerDna({
      modifiers: {},
      path,
    });

    t.ok(hash);
    const installedApp = await admin.installApp({
      installed_app_id,
      agent_key,
      path: `${FIXTURE_PATH}/test.happ`,
      membrane_proofs: {},
    });

    const status: InstalledAppInfoStatus = installedApp.status;
    t.deepEqual(status, { disabled: { reason: { never_started: null } } });

    const runningApps = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(runningApps.length, 0);

    let allAppsInfo = await admin.listApps({});
    t.equal(allAppsInfo.length, 1);

    const runningAppsInfo = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    const disabledAppsInfo = await admin.listApps({
      status_filter: AppStatusFilter.Disabled,
    });
    const pausedAppsInfo = await admin.listApps({
      status_filter: AppStatusFilter.Paused,
    });
    t.equal(runningAppsInfo.length, 0);
    t.equal(pausedAppsInfo.length, 0);
    t.equal(disabledAppsInfo.length, 1);
    t.equal(disabledAppsInfo[0].cell_info[ROLE_NAME].length, 1);
    t.deepEqual(disabledAppsInfo[0].status, {
      disabled: { reason: { never_started: null } },
    });

    const { app, errors } = await admin.enableApp({ installed_app_id });
    t.deepEqual(app.status, { running: null });
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
    t.deepEqual(runningAppsInfo2[0].status, { running: null });

    await admin.attachAppInterface({ port: 0 });
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
      disabled: { reason: { user: null } },
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
  withConductor(ADMIN_PORT, async (t: Test) => {
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect(
      `ws://127.0.0.1:${ADMIN_PORT}`,
      12000
    );

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
      disabled: { reason: { never_started: null } },
    });

    const runningApps1 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(runningApps1.length, 0);

    const enabledAppInfo = await admin.enableApp({ installed_app_id });
    t.deepEqual(enabledAppInfo.app.status, { running: null });
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
    t.deepEqual(
      cellIds[0],
      installedApp.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id
    );

    await admin.attachAppInterface({ port: 0 });
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
  withConductor(ADMIN_PORT, async (t: Test) => {
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect(
      `ws://127.0.0.1:${ADMIN_PORT}`,
      12000
    );

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
    t.deepEqual(enabledAppInfo.app.status, { running: null });
    // t.equal(enabledAppInfo.app.cell_info[0].role_name, role_name);
    t.equal(enabledAppInfo.app.installed_app_id, installed_app_id);
    t.equal(enabledAppInfo.errors.length, 0);

    const runningApps2 = await admin.listApps({
      status_filter: AppStatusFilter.Running,
    });
    t.equal(runningApps2.length, 1);
    t.equal(runningApps2[0].installed_app_id, installed_app_id);

    await admin.attachAppInterface({ port: 0 });
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
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, cell_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    let info = await client.appInfo({ installed_app_id }, 1000);
    assert(CellType.Provisioned in info.cell_info[ROLE_NAME][0]);
    t.deepEqual(
      info.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id,
      cell_id
    );
    t.ok(ROLE_NAME in info.cell_info);
    t.deepEqual(info.status, { running: null });
    const appEntryDef: AppEntryDef = {
      entry_index: 0,
      zome_index: 0,
      visibility: { Private: null },
    };

    const zomeCallPayload: CallZomeRequest = {
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "echo_app_entry_def",
      provenance: cell_id[1],
      payload: appEntryDef,
    };

    await admin.authorizeSigningCredentials(cell_id);

    const response = await client.callZome(zomeCallPayload, 30000);
    t.equal(response, null, "app entry def deserializes correctly");

    await admin.disableApp({ installed_app_id });
    info = await client.appInfo({ installed_app_id }, 1000);
    t.deepEqual(info.status, { disabled: { reason: { user: null } } });
  })
);

test(
  "install app with app manifest from path",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const role_name = "foo";
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect(`ws://127.0.0.1:${ADMIN_PORT}`);
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
        },
        resources: {},
      },
      membrane_proofs: {},
    });
    await admin.enableApp({ installed_app_id });
    const { port: appPort } = await admin.attachAppInterface({ port: 0 });
    const client = await AppWebsocket.connect(`ws://127.0.0.1:${appPort}`);

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
  withConductor(ADMIN_PORT, async (t: Test) => {
    const role_name = "foo";
    const installed_app_id = "app";
    const admin = await AdminWebsocket.connect(`ws://127.0.0.1:${ADMIN_PORT}`);
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
        },
        resources: {
          dna_1: zippedDnaBundle,
        },
      },
      membrane_proofs: {},
    });
    await admin.enableApp({ installed_app_id });
    const { port: appPort } = await admin.attachAppInterface({ port: 0 });
    const client = await AppWebsocket.connect(`ws://127.0.0.1:${appPort}`);

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
  "stateDump",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, cell_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    const info = await client.appInfo({ installed_app_id });
    assert(CellType.Provisioned in info.cell_info[ROLE_NAME][0]);
    t.deepEqual(
      info.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id,
      cell_id
    );
    t.ok(ROLE_NAME in info.cell_info);
    t.deepEqual(info.status, { running: null });
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
    // A couple random tests to prove that things are where we expect them
    t.equal(state[0].source_chain_dump.records.length, 7);
    t.equal(state[0].source_chain_dump.records[0].action.type, "Dna");
  })
);

test(
  "can receive a signal using event handler",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { admin, cell_id, client } = await installAppAndDna(ADMIN_PORT);
    let resolveSignalPromise: (value?: unknown) => void | undefined;
    const signalReceivedPromise = new Promise(
      (resolve) => (resolveSignalPromise = resolve)
    );
    const signalCb = (signal: AppSignal) => {
      t.deepEqual(signal, {
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

// no conductor
test("error is catchable when holochain socket is unavailable", async (t: Test) => {
  const url = `ws://127.0.0.1:${ADMIN_PORT}`;
  try {
    await AdminWebsocket.connect(url);
  } catch (e) {
    t.equal(
      e.message,
      `could not connect to holochain conductor, please check that a conductor service is running and available at ${url}`
    );
  }

  try {
    await AppWebsocket.connect(url);
  } catch (e) {
    t.equal(
      e.message,
      `could not connect to holochain conductor, please check that a conductor service is running and available at ${url}`
    );
  }
});

test("can inject agents", async (t: Test) => {
  const conductor1 = await launch(ADMIN_PORT);
  const conductor2 = await launch(ADMIN_PORT_1);
  const installed_app_id = "app";
  const admin1 = await AdminWebsocket.connect(`ws://127.0.0.1:${ADMIN_PORT}`);
  const admin2 = await AdminWebsocket.connect(`ws://127.0.0.1:${ADMIN_PORT_1}`);
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
  t.deepEqual(activeApp1Info.app.status, { running: null });
  t.ok(ROLE_NAME in activeApp1Info.app.cell_info);
  t.equal(activeApp1Info.app.installed_app_id, installed_app_id);
  t.equal(activeApp1Info.errors.length, 0);

  await delay(500);

  // after activating an app requestAgentInfo should return the agentid
  // requesting info with null cell_id should return all agents known about.
  // otherwise it's just agents know about for that cell
  const conductor1_agentInfo = await admin1.agentInfo({
    cell_id: null,
  });
  t.equal(conductor1_agentInfo.length, 1);

  // agent2 with no activated apps there are no agents
  let conductor2_agentInfo = await admin2.agentInfo({ cell_id: null });
  t.equal(conductor2_agentInfo.length, 0);

  // but, after explicitly injecting an agent, we should see it
  await admin2.addAgentInfo({ agent_infos: conductor1_agentInfo });
  conductor2_agentInfo = await admin2.agentInfo({ cell_id: null });
  t.equal(conductor2_agentInfo.length, 1);
  t.deepEqual(conductor1_agentInfo, conductor2_agentInfo);

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
  t.deepEqual(activeApp2Info.app.status, { running: null });
  t.ok(ROLE_NAME in activeApp2Info.app.cell_info);
  t.equal(activeApp2Info.app.installed_app_id, installed_app_id);
  t.equal(activeApp2Info.errors.length, 0);

  await delay(500);
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
  "admin smoke test: listAppInterfaces + attachAppInterface",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const admin = await AdminWebsocket.connect(`ws://127.0.0.1:${ADMIN_PORT}`);

    let interfaces = await admin.listAppInterfaces();
    t.equal(interfaces.length, 0);

    await admin.attachAppInterface({ port: 21212 });

    interfaces = await admin.listAppInterfaces();
    t.equal(interfaces.length, 1);
  })
);

test(
  "can use some of the defined js bindings",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, cell_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    let info = await client.appInfo({ installed_app_id }, 1000);
    assert(CellType.Provisioned in info.cell_info[ROLE_NAME][0]);
    t.deepEqual(
      info.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id,
      cell_id
    );
    t.ok(ROLE_NAME in info.cell_info);
    t.deepEqual(info.status, { running: null });
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
    info = await client.appInfo({ installed_app_id }, 1000);
    t.deepEqual(info.status, { disabled: { reason: { user: null } } });
  })
);

test(
  "admin smoke test: install 2 hApp bundles with different network seeds",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const admin = await AdminWebsocket.connect(`ws://127.0.0.1:${ADMIN_PORT}`);
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
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    const appInfo = await client.appInfo({ installed_app_id });

    const createCloneCellParams: CreateCloneCellRequest = {
      app_id: installed_app_id,
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
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    const createCloneCellParams: CreateCloneCellRequest = {
      app_id: installed_app_id,
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await client.createCloneCell(createCloneCellParams);

    await admin.authorizeSigningCredentials(cloneCell.cell_id);

    await client.disableCloneCell({
      app_id: installed_app_id,
      clone_cell_id: cloneCell.cell_id,
    });

    const appInfo = await client.appInfo({ installed_app_id });
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
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    const createCloneCellParams: CreateCloneCellRequest = {
      app_id: installed_app_id,
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await client.createCloneCell(createCloneCellParams);
    await client.disableCloneCell({
      app_id: installed_app_id,
      clone_cell_id: cloneCell.cell_id,
    });

    const enabledCloneCell = await client.enableCloneCell({
      app_id: installed_app_id,
      clone_cell_id: CloneId.fromRoleName(cloneCell.clone_id).toString(),
    });

    const appInfo = await client.appInfo({ installed_app_id });
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
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    const createCloneCellParams: CreateCloneCellRequest = {
      app_id: installed_app_id,
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await client.createCloneCell(createCloneCellParams);
    createCloneCellParams.modifiers.network_seed = "clone-1";
    await client.disableCloneCell({
      app_id: installed_app_id,
      clone_cell_id: cloneCell.cell_id,
    });

    await admin.deleteCloneCell({
      app_id: installed_app_id,
      clone_cell_id: cloneCell.cell_id,
    });

    try {
      await client.enableCloneCell({
        app_id: installed_app_id,
        clone_cell_id: cloneCell.cell_id,
      });
      t.fail();
    } catch (error) {
      t.pass("deleted clone cell cannot be enabled");
    }
  })
);

test(
  "requests get canceled if the websocket closes while waiting for a response",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { cell_id, client, admin } = await installAppAndDna(ADMIN_PORT);

    await admin.authorizeSigningCredentials(cell_id);

    const call1 = client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "waste_some_time",
      provenance: cell_id[1],
      payload: null,
    });
    const call2 = client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "waste_some_time",
      provenance: cell_id[1],
      payload: null,
    });

    await delay(100);

    const closeEventCode = 1000;
    client.client.close(closeEventCode);
    t.ok(
      client.client.socket.readyState !== client.client.socket.OPEN,
      "ws is not open"
    );

    const [res1, res2] = await Promise.allSettled([call1, call2]);
    assert(res1.status === "rejected");
    t.ok(
      res1.reason
        .toString()
        .startsWith(
          `Error: Websocket closed with pending requests. Close event code: ${closeEventCode}, request id:`
        ),
      "pending request was rejected with correct close event code"
    );
    assert(res2.status === "rejected");
    t.ok(
      res2.reason
        .toString()
        .startsWith(
          `Error: Websocket closed with pending requests. Close event code: ${closeEventCode}, request id:`
        ),
      "pending request was rejected with correct close event code"
    );
  })
);
