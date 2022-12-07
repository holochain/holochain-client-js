import test, { Test } from "tape";
import {
  AppAgentWebsocket,
  AppCreateCloneCellRequest,
} from "../../src/api/app-agent/index.js";
import { AppSignal, CallZomeRequest } from "../../src/api/app/index.js";
import { CloneId } from "../../src/api/common.js";
import { AppEntryType } from "../../src/hdk/entry.js";
import { installAppAndDna, withConductor } from "./util.js";

const fakeAgentPubKey = () =>
  Buffer.from(
    [0x84, 0x20, 0x24].concat(
      "000000000000000000000000000000000000"
        .split("")
        .map((x) => parseInt(x, 10))
    )
  );

const ADMIN_PORT = 33001;

const TEST_ZOME_NAME = "foo";
const COORDINATOR_ZOME_NAME = "coordinator";

test(
  "can call a zome function and get app info",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, cell_id, role_id, client, admin } =
      await installAppAndDna(ADMIN_PORT);

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

    const response = await appAgentWs.callZome({
      cap_secret: null,
      cell_id,
      zome_name: COORDINATOR_ZOME_NAME,
      fn_name: "echo_app_entry_type",
      provenance: cell_id[1],
      payload: appEntryType,
    });

    t.equal(response, null, "app entry type deserializes correctly");

    const response_from_role_id = await appAgentWs.callZome({
      cap_secret: null,
      role_id,
      zome_name: COORDINATOR_ZOME_NAME,
      fn_name: "echo_app_entry_type",
      provenance: cell_id[1],
      payload: appEntryType,
    });

    t.equal(
      response_from_role_id,
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
        type: "Signal",
        data: {
          cellId: cell_id,
          payload: "i am a signal",
        },
      });
      resolveSignalPromise();
    };

    const { cell_id, client, installed_app_id } = await installAppAndDna(
      ADMIN_PORT
    );

    const appAgentWs = new AppAgentWebsocket(client, installed_app_id);

    appAgentWs.on("signal", signalCb);

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

    const appAgentWs = new AppAgentWebsocket(client, installed_app_id);

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
