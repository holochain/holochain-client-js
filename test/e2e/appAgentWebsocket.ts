import test, { Test } from "tape";
import {
  AdminWebsocket,
  DumpStateResponse,
} from "../../src/api/admin/index.js";
import {
  AppSignal,
  AppWebsocket,
  CallZomeRequest,
  CreateCloneCellRequest,
} from "../../src/api/app/index.js";
import {
  AppAgentWebsocket, AppCreateCloneCellRequest,
} from "../../src/api/app_agent/index.js";
import { WsClient } from "../../src/api/client.js";
import { CloneId } from "../../src/api/common.js";
import { AppEntryType } from "../../src/hdk/entry.js";
import {
  cleanSandboxConductors,
  FIXTURE_PATH,
  installAppAndDna,
  launch,
  withConductor,
} from "./util.js";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

const TEST_ZOME_NAME = "foo";
const COORDINATOR_ZOME_NAME = "coordinator";

test(
  "can call a zome function and get app info",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, cell_id, role_id, client, admin } = await installAppAndDna(ADMIN_PORT);

    const appAgentWs = new AppAgentWebsocket(client, installed_app_id);

    let info = await appAgentWs.appInfo();
    t.deepEqual(info.cell_data[0].cell_id, cell_id);
    t.equal(info.cell_data[0].role_id, role_id);
    t.deepEqual(info.status, { running: null });

    const appEntryType: AppEntryType = {
      id: 0,
      zome_id: 0,
      visibility: { Private: null },
    };

    const response = await appAgentWs.callZome(
      {
        cap_secret: null,
        cell_id,
        zome_name: COORDINATOR_ZOME_NAME,
        fn_name: "echo_app_entry_type",
        provenance: cell_id[1],
        payload: appEntryType,
      }        
    );

    t.equal(response, null, "app entry type deserializes correctly");

    const response_from_role_id = await appAgentWs.callZome(
      {
        cap_secret: null,
        role_id,
        zome_name: COORDINATOR_ZOME_NAME,
        fn_name: "echo_app_entry_type",
        provenance: cell_id[1],
        payload: appEntryType,
      }        
    );

    t.equal(response_from_role_id, null, "app entry type deserializes correctly");

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
        type: "Signal",
        data: {
          cellId: cell_id,
          payload: "i am a signal",
        },
      });
      resolveSignalPromise();
    };

    const { cell_id, client, installed_app_id } = await installAppAndDna(ADMIN_PORT);

    const appAgentWs = new AppAgentWebsocket(client, installed_app_id);
    
    appAgentWs.on('signal', signalCb)

    // trigger an emit_signal
    await appAgentWs.callZome({
      cap_secret: null,
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
  "can create a callable clone cell",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, role_id, client } = await installAppAndDna(
      ADMIN_PORT
    );
    const info = await client.appInfo({ installed_app_id });

    const appAgentWs = new AppAgentWebsocket(client, installed_app_id);

    const createCloneCellParams: AppCreateCloneCellRequest = {
      role_id,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await appAgentWs.createCloneCell(createCloneCellParams);

    const expectedCloneId = new CloneId(role_id, 0).toString();
    t.equal(cloneCell.role_id, expectedCloneId, "correct clone id");
    t.deepEqual(
      cloneCell.cell_id[1],
      info.cell_data[0].cell_id[1],
      "clone cell agent key matches base cell agent key"
    );
    const params: CallZomeRequest = {
      cap_secret: null,
      cell_id: cloneCell.cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    const response = await appAgentWs.callZome(params);
    t.equal(
      response,
      "foo",
      "clone cell can be called with same zome call as base cell"
    );
  })
);

test(
  "can archive a clone cell",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, role_id, client } = await installAppAndDna(
      ADMIN_PORT
    );

    const appAgentWs = new AppAgentWebsocket(client, installed_app_id)

    const createCloneCellParams: AppCreateCloneCellRequest = {
      role_id,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await appAgentWs.createCloneCell(createCloneCellParams);

    await appAgentWs.archiveCloneCell({
      clone_cell_id: cloneCell.cell_id,
    });

    const appInfo = await appAgentWs.appInfo();
    t.equal(
      appInfo.cell_data.length,
      1,
      "archived clone cell is not part of app info"
    );
    const params: CallZomeRequest = {
      cap_secret: null,
      cell_id: cloneCell.cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    try {
      await appAgentWs.callZome(params);
      t.fail();
    } catch (error) {
      t.pass("archived clone call cannot be called");
    }
  })
);

test.skip(
  "can restore an archived clone cell",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, role_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    const createCloneCellParams: CreateCloneCellRequest = {
      app_id: installed_app_id,
      role_id,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await client.createCloneCell(createCloneCellParams);
    await client.archiveCloneCell({
      app_id: installed_app_id,
      clone_cell_id: cloneCell.cell_id,
    });

    await admin.restoreCloneCell({
      app_id: installed_app_id,
      clone_cell_id: CloneId.fromRoleId(cloneCell.role_id).toString(),
    });

    const appInfo = await client.appInfo({ installed_app_id });
    t.equal(
      appInfo.cell_data.length,
      2,
      "restored clone cell is part of app info"
    );
    const params: CallZomeRequest = {
      cap_secret: null,
      cell_id: cloneCell.cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    const resopnse = await client.callZome(params);
    t.equal(resopnse, "foo", "restored clone cell can be called");
  })
);

test.skip(
  "can delete archived clone cells of an app",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, role_id, client, admin } = await installAppAndDna(
      ADMIN_PORT
    );
    const createCloneCellParams: CreateCloneCellRequest = {
      app_id: installed_app_id,
      role_id,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell0 = await client.createCloneCell(createCloneCellParams);
    createCloneCellParams.modifiers.network_seed = "clone-1";
    const cloneCell1 = await client.createCloneCell(createCloneCellParams);
    await client.archiveCloneCell({
      app_id: installed_app_id,
      clone_cell_id: cloneCell0.cell_id,
    });
    await client.archiveCloneCell({
      app_id: installed_app_id,
      clone_cell_id: cloneCell1.cell_id,
    });

    await admin.deleteArchivedCloneCells({ app_id: installed_app_id, role_id });

    try {
      await admin.restoreCloneCell({
        app_id: installed_app_id,
        clone_cell_id: cloneCell0.cell_id,
      });
      t.fail();
    } catch (error) {
      t.pass("deleted clone cell 0 cannot be restored");
    }
    try {
      await admin.restoreCloneCell({
        app_id: installed_app_id,
        clone_cell_id: cloneCell1.cell_id,
      });
      t.fail();
    } catch (error) {
      t.pass("deleted clone cell 1 cannot be restored");
    }
  })
);

//

test.skip(
  "stateDump",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, cell_id, role_id, client, admin } =
      await installAppAndDna(ADMIN_PORT);
    const info = await client.appInfo({ installed_app_id }, 1000);
    t.deepEqual(info.cell_data[0].cell_id, cell_id);
    t.equal(info.cell_data[0].role_id, role_id);
    t.deepEqual(info.status, { running: null });
    const response = await client.callZome(
      {
        // TODO: write a test with a real capability secret.
        cap_secret: null,
        cell_id,
        zome_name: TEST_ZOME_NAME,
        fn_name: "foo",
        provenance: fakeAgentPubKey(),
        payload: null,
      }
    );
    t.equal(response, "foo");

    const state: DumpStateResponse = await admin.dumpState({
      cell_id: info.cell_data[0].cell_id,
    });
    // A couple random tests to prove that things are where we expect them
    t.equal(state[0].source_chain_dump.records.length, 6);
    t.equal(state[0].source_chain_dump.records[0].action.type, "Dna");
  })
);
