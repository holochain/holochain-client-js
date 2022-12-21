import test, { Test } from "tape";
import assert from "node:assert";
import {
  AppAgentWebsocket,
  AppCreateCloneCellRequest,
  AppSignal,
  CloneId,
  AppEntryDef,
  RoleName,
  authorizeSigningCredentials,
  AppAgentCallZomeRequest,
  NonProvenanceCallZomeRequest,
  fakeAgentPubKey,
  CellType,
} from "../../src/index.js";
import { installAppAndDna, withConductor } from "./util.js";

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

    await authorizeSigningCredentials(admin, cell_id, [
      [COORDINATOR_ZOME_NAME, "echo_app_entry_def"],
    ]);

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
    const signalCb = (signal: AppSignal) => {
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

    await authorizeSigningCredentials(admin, cell_id, [
      [TEST_ZOME_NAME, "emitter"],
    ]);

    const appAgentWs = await AppAgentWebsocket.connect(
      client,
      installed_app_id
    );

    appAgentWs.on("signal", signalCb);

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
    await authorizeSigningCredentials(admin, cloneCell.cell_id, [
      [TEST_ZOME_NAME, "foo"],
    ]);

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
    await authorizeSigningCredentials(admin, cloneCell.cell_id, [
      [TEST_ZOME_NAME, "foo"],
    ]);

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
