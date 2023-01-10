import test, { Test } from "tape";
import assert from "node:assert";
import {
  AppAgentWebsocket,
  AppCreateCloneCellRequest,
  AppSignal,
  CloneId,
  AppEntryDef,
  RoleName,
  AppAgentCallZomeRequest,
  NonProvenanceCallZomeRequest,
  fakeAgentPubKey,
  CellType,
  AppSignalCb,
  AdminWebsocket,
  AppWebsocket,
} from "../../src/index.js";
import { FIXTURE_PATH, installAppAndDna, withConductor } from "./util.js";

const ADMIN_PORT = 33001;

const ROLE_NAME: RoleName = "foo";
const TEST_ZOME_NAME = "foo";
const COORDINATOR_ZOME_NAME = "coordinator";

test(
  "can call a zome function and get app info",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, cell_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );

    const appAgentWs = await AppAgentWebsocket.connect(
      client,
      installed_app_id
    );

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
      zome_name: COORDINATOR_ZOME_NAME,
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
      zome_name: COORDINATOR_ZOME_NAME,
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
  withConductor(ADMIN_PORT, async (t: Test) => {
    let resolveSignalPromise: (value?: unknown) => void | undefined;
    const signalReceivedPromise = new Promise(
      (resolve) => (resolveSignalPromise = resolve)
    );
    const signalCb: AppSignalCb = (signal) => {
      t.deepEqual(signal, {
        type: "signal",
        data: {
          cellId: cell_id,
          payload: "i am a signal",
        },
      });
      resolveSignalPromise();
    };

    const { admin, cell_id, client, installed_app_id } = await installAppAndDna(
      ADMIN_PORT
    );

    await admin.authorizeSigningCredentials(cell_id);

    const appAgentWs = await AppAgentWebsocket.connect(
      client,
      installed_app_id
    );

    appAgentWs.on("signal", cell_id, signalCb);

    // trigger an emit_signal
    await appAgentWs.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "emitter",
      provenance: fakeAgentPubKey(),
      payload: null,
    });
    await signalReceivedPromise;
  })
);

test.only(
  "cells only receive its own signals",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const role_name = "foo";
    const admin = await AdminWebsocket.connect(`ws://127.0.0.1:${ADMIN_PORT}`);
    const path = `${FIXTURE_PATH}/test.happ`;
    const { port: appPort } = await admin.attachAppInterface({ port: 0 });

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
    const app2 = await admin.installApp({
      installed_app_id: app_id2,
      agent_key: agent2,
      path,
      membrane_proofs: {},
    });
    assert(CellType.Provisioned in app2.cell_info[role_name][0]);
    const cell_id2 = app2.cell_info[role_name][0][CellType.Provisioned].cell_id;
    await admin.enableApp({ installed_app_id: app_id2 });

    let received2 = false;
    const signalCb2: AppSignalCb = () => {
      received2 = true;
    };

    const client = await AppWebsocket.connect(`ws://127.0.0.1:${appPort}`);
    await admin.authorizeSigningCredentials(cell_id1);

    const appAgentWs = await AppAgentWebsocket.connect(client, app_id1);

    appAgentWs.on("signal", cell_id1, signalCb1);
    appAgentWs.on("signal", cell_id2, signalCb2);

    // trigger an emit_signal
    await appAgentWs.callZome({
      cell_id: cell_id1,
      zome_name: TEST_ZOME_NAME,
      fn_name: "emitter",
      provenance: fakeAgentPubKey(),
      payload: null,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    t.equal(received1, true);
    t.equal(received2, false);
  })
);

test(
  "can create a callable clone cell and call it by clone id",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { admin, installed_app_id, client } = await installAppAndDna(
      ADMIN_PORT
    );
    const info = await client.appInfo({ installed_app_id });

    const appAgentWs = await AppAgentWebsocket.connect(
      client,
      installed_app_id
    );

    const createCloneCellParams: AppCreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await appAgentWs.createCloneCell(createCloneCellParams);
    await admin.authorizeSigningCredentials(cloneCell.cell_id);

    const expectedCloneId = new CloneId(ROLE_NAME, 0).toString();
    t.equal(cloneCell.role_name, expectedCloneId, "correct clone id");
    assert(CellType.Provisioned in info.cell_info[ROLE_NAME][0]);
    t.deepEqual(
      cloneCell.cell_id[1],
      info.cell_info[ROLE_NAME][0][CellType.Provisioned].cell_id[1],
      "clone cell agent key matches base cell agent key"
    );

    const params: AppAgentCallZomeRequest = {
      role_name: cloneCell.role_name,
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
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { admin, installed_app_id, client } = await installAppAndDna(
      ADMIN_PORT
    );

    const appAgentWs = await AppAgentWebsocket.connect(
      client,
      installed_app_id
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
