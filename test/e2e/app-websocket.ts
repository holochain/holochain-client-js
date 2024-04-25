import assert from "node:assert";
import test from "tape";
import {
  AdminWebsocket,
  AppAgentCallZomeRequest,
  AppWebsocket,
  AppCreateCloneCellRequest,
  AppEntryDef,
  AppSignalCb,
  CellType,
  CloneId,
  fakeAgentPubKey,
  NonProvenanceCallZomeRequest,
  RoleName,
} from "../../src";
import {
  createAppAgentWsAndInstallApp,
  FIXTURE_PATH,
  withConductor,
} from "./common.js";

const ADMIN_PORT = 33001;

const ROLE_NAME: RoleName = "foo";
const TEST_ZOME_NAME = "foo";

test(
  "can call a zome function and get app info",
  withConductor(ADMIN_PORT, async (t) => {
    const {
      installed_app_id,
      cell_id,
      client: appAgentWs,
      admin,
    } = await createAppAgentWsAndInstallApp(ADMIN_PORT);

    let info = await appAgentWs.appInfo();
    assert(CellType.Provisioned in info.cell_info[ROLE_NAME][0]);
    t.deepEqual(
      info.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id,
      cell_id
    );
    t.ok(ROLE_NAME in info.cell_info);
    t.deepEqual(info.status, { running: null });

    await admin.authorizeSigningCredentials(cell_id);

    const appEntryDef: AppEntryDef = {
      entry_index: 0,
      zome_index: 0,
      visibility: { Private: null },
    };

    const response = await appAgentWs.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "echo_app_entry_def",
      payload: appEntryDef,
    });

    t.equal(response, null, "app entry type deserializes correctly");

    const cellIdFromRoleName = appAgentWs.getCellIdFromRoleName(
      ROLE_NAME,
      info
    );
    t.deepEqual(cellIdFromRoleName, cell_id);

    const response_from_role_name = await appAgentWs.callZome({
      role_name: ROLE_NAME,
      zome_name: TEST_ZOME_NAME,
      fn_name: "echo_app_entry_def",
      payload: appEntryDef,
    });

    t.equal(
      response_from_role_name,
      null,
      "app entry type deserializes correctly"
    );

    await admin.disableApp({ installed_app_id });
    info = await appAgentWs.appInfo();
    t.deepEqual(info.status, { disabled: { reason: { user: null } } });
  })
);

test(
  "can receive a signal",
  withConductor(ADMIN_PORT, async (t) => {
    let resolveSignalPromise: (value?: unknown) => void | undefined;
    const signalReceivedPromise = new Promise(
      (resolve) => (resolveSignalPromise = resolve)
    );
    const signalCb: AppSignalCb = (signal) => {
      t.deepEqual(signal, {
        cell_id,
        zome_name: TEST_ZOME_NAME,
        payload: "i am a signal",
      });
      resolveSignalPromise();
    };

    const {
      admin,
      cell_id,
      client: appAgentWs,
    } = await createAppAgentWsAndInstallApp(ADMIN_PORT);

    await admin.authorizeSigningCredentials(cell_id);

    appAgentWs.on("signal", signalCb);

    // trigger an emit_signal
    await appAgentWs.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "emitter",
      provenance: await fakeAgentPubKey(),
      payload: null,
    });
    await signalReceivedPromise;
  })
);

test(
  "cells only receive their own signals",
  withConductor(ADMIN_PORT, async (t) => {
    const role_name = "foo";
    const admin = await AdminWebsocket.connect({
      url: new URL(`ws://localhost:${ADMIN_PORT}`),
      wsClientOptions: { origin: "client-test-admin" },
    });
    const path = `${FIXTURE_PATH}/test.happ`;
    const { port: appPort } = await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });

    const app_id1 = "app1";
    const agent1 = await admin.generateAgentPubKey();
    const app1 = await admin.installApp({
      installed_app_id: app_id1,
      agent_key: agent1,
      path,
      membrane_proofs: {},
    });
    assert(CellType.Provisioned in app1.cell_info[role_name][0]);
    const cell_id1 = app1.cell_info[role_name][0][CellType.Provisioned].cell_id;
    await admin.enableApp({ installed_app_id: app_id1 });

    let received1 = false;
    const signalCb1: AppSignalCb = () => {
      received1 = true;
    };

    const app_id2 = "app2";
    const agent2 = await admin.generateAgentPubKey();
    await admin.installApp({
      installed_app_id: app_id2,
      agent_key: agent2,
      path,
      membrane_proofs: {},
    });
    await admin.enableApp({ installed_app_id: app_id2 });

    let received2 = false;
    const signalCb2: AppSignalCb = () => {
      received2 = true;
    };

    await admin.authorizeSigningCredentials(cell_id1);

    const issued1 = await admin.issueAppAuthenticationToken({
      installed_app_id: app_id1,
    });
    const clientUrl = new URL(`ws://localhost:${appPort}`);
    const appAgentWs1 = await AppWebsocket.connect(issued1.token, {
      url: clientUrl,
      wsClientOptions: { origin: "client-test-app" },
    });
    const issued2 = await admin.issueAppAuthenticationToken({
      installed_app_id: app_id2,
    });
    const appAgentWs2 = await AppWebsocket.connect(issued2.token, {
      url: clientUrl,
      wsClientOptions: { origin: "client-test-app" },
    });

    appAgentWs1.on("signal", signalCb1);
    appAgentWs2.on("signal", signalCb2);

    // trigger an emit_signal
    await appAgentWs1.callZome({
      cell_id: cell_id1,
      zome_name: TEST_ZOME_NAME,
      fn_name: "emitter",
      provenance: await fakeAgentPubKey(),
      payload: null,
    });

    // signals are received before the timeout step in the JS event loop is completed
    await new Promise((resolve) => setTimeout(resolve, 0));
    t.equal(received1, true);
    t.equal(received2, false);
  })
);

test(
  "can create a callable clone cell and call it by clone id",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin, client: appAgentWs } = await createAppAgentWsAndInstallApp(
      ADMIN_PORT
    );
    const info = await appAgentWs.appInfo();

    const createCloneCellParams: AppCreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await appAgentWs.createCloneCell(createCloneCellParams);
    await admin.authorizeSigningCredentials(cloneCell.cell_id);

    const expectedCloneId = new CloneId(ROLE_NAME, 0).toString();
    t.equal(cloneCell.clone_id, expectedCloneId, "correct clone id");
    assert(CellType.Provisioned in info.cell_info[ROLE_NAME][0]);
    t.deepEqual(
      cloneCell.cell_id[1],
      info.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id[1],
      "clone cell agent key matches base cell agent key"
    );

    const params: AppAgentCallZomeRequest = {
      role_name: cloneCell.clone_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      payload: null,
    };
    const response = await appAgentWs.callZome(params);
    t.equal(
      response,
      "foo",
      "clone cell can be called with same zome call as base cell, and by clone id"
    );
  })
);

test(
  "can disable and re-enable a clone cell",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin, client: appAgentWs } = await createAppAgentWsAndInstallApp(
      ADMIN_PORT
    );

    const createCloneCellParams: AppCreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await appAgentWs.createCloneCell(createCloneCellParams);
    await admin.authorizeSigningCredentials(cloneCell.cell_id);

    await appAgentWs.disableCloneCell({
      clone_cell_id: cloneCell.cell_id,
    });

    const appInfo = await appAgentWs.appInfo();
    t.equal(
      appInfo.cell_info[ROLE_NAME].length,
      2,
      "disabled clone cell is part of app info"
    );
    const params: NonProvenanceCallZomeRequest = {
      cell_id: cloneCell.cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      payload: null,
    };
    try {
      await appAgentWs.callZome(params);
      t.fail();
    } catch (error) {
      t.pass("disabled clone call cannot be called");
    }

    await appAgentWs.enableCloneCell({
      clone_cell_id: cloneCell.cell_id,
    });
    await appAgentWs.callZome(params);
    t.pass("re-enabled clone can be called");
  })
);

test(
  "can fetch network info",
  withConductor(ADMIN_PORT, async (t) => {
    const { client: appAgentWs, cell_id } = await createAppAgentWsAndInstallApp(
      ADMIN_PORT
    );

    const response = await appAgentWs.networkInfo({
      dnas: [cell_id[0]],
    });

    t.deepEqual(response, [
      {
        fetch_pool_info: { op_bytes_to_fetch: 0, num_ops_to_fetch: 0 },
        current_number_of_peers: 1,
        arc_size: 1,
        total_network_peers: 1,
        bytes_since_last_time_queried: 1844,
        completed_rounds_since_last_time_queried: 0,
      },
    ]);
  })
);
