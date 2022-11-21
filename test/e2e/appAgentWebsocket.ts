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
  AppAgentWebsocket,
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
  "can call a zome function and get app ino",
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

    await admin.disableApp({ installed_app_id });
    info = await appAgentWs.appInfo();
    t.deepEqual(info.status, { disabled: { reason: { user: null } } });
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

test.skip(
  "can call a zome function twice, reusing args",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, cell_id, role_id, client } =
      await installAppAndDna(ADMIN_PORT);
    const info = await client.appInfo({ installed_app_id }, 1000);
    t.deepEqual(info.cell_data[0].cell_id, cell_id);
    t.equal(info.cell_data[0].role_id, role_id);
    const args: CallZomeRequest = {
      // TODO: write a test with a real capability secret.
      cap_secret: null,
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
      provenance: fakeAgentPubKey(),
      payload: null,
    };
    const response = await client.callZome(args, 30000);
    t.equal(response, "foo");
    const response2 = await client.callZome(args, 30000);
    t.equal(response2, "foo");
  })
);

test.skip(
  "can handle canceled response",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const client = new WsClient({
      send: () => {
        /* do nothing */
      },
    });
    const prom = client.request("blah");
    client.handleResponse({ id: 0 });
    try {
      await prom;
    } catch (e) {
      t.deepEqual(e, new Error("Response canceled by responder"));
    }
  })
);

test.skip(
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

    const { cell_id, client } = await installAppAndDna(ADMIN_PORT, signalCb);
    // trigger an emit_signal
    await client.callZome({
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

// no conductor
test.skip("error is catchable when holochain socket is unavailable", async (t: Test) => {
  const url = `ws://localhost:${ADMIN_PORT}`;
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

test.skip("can inject agents", async (t: Test) => {
  const conductor1 = await launch(ADMIN_PORT);
  const conductor2 = await launch(ADMIN_PORT_1);
  const installed_app_id = "app";
  const admin1 = await AdminWebsocket.connect(`ws://localhost:${ADMIN_PORT}`);
  const admin2 = await AdminWebsocket.connect(`ws://localhost:${ADMIN_PORT_1}`);
  const agent_key_1 = await admin1.generateAgentPubKey();
  t.ok(agent_key_1);
  const agent_key_2 = await admin2.generateAgentPubKey();
  t.ok(agent_key_2);
  const role = "thedna";
  const path = `${FIXTURE_PATH}/test.dna`;
  const hash = await admin1.registerDna({ path, modifiers: {} });
  t.ok(hash);
  let result = await admin1.installApp({
    installed_app_id,
    agent_key: agent_key_1,
    dnas: [{ hash, role_id: role }],
  });
  t.ok(result);
  const app1_cell = result.cell_data[0].cell_id;
  const activeApp1Info = await admin1.enableApp({ installed_app_id }, 1000);
  t.deepEqual(activeApp1Info.app.status, { running: null });
  t.equal(activeApp1Info.app.cell_data[0].role_id, role);
  t.equal(activeApp1Info.app.installed_app_id, installed_app_id);
  t.equal(activeApp1Info.errors.length, 0);

  await delay(500);

  // after activating an app requestAgentInfo should return the agentid
  // requesting info with null cell_id should return all agents known about.
  // otherwise it's just agents know about for that cell
  const conductor1_agentInfo = await admin1.requestAgentInfo({
    cell_id: null,
  });
  t.equal(conductor1_agentInfo.length, 1);

  // agent2 with no activated apps there are no agents
  let conductor2_agentInfo = await admin2.requestAgentInfo({ cell_id: null });
  t.equal(conductor2_agentInfo.length, 0);

  // but, after explicitly injecting an agent, we should see it
  await admin2.addAgentInfo({ agent_infos: conductor1_agentInfo });
  conductor2_agentInfo = await admin2.requestAgentInfo({ cell_id: null });
  t.equal(conductor2_agentInfo.length, 1);
  t.deepEqual(conductor1_agentInfo, conductor2_agentInfo);

  // now install the app and activate it on agent 2.
  await admin2.registerDna({
    modifiers: {},
    path,
  });
  t.ok(hash);
  result = await admin2.installApp({
    installed_app_id,
    agent_key: agent_key_2,
    dnas: [{ hash, role_id: role }],
  });
  t.ok(result);
  const app2_cell = result.cell_data[0].cell_id;
  const activeApp2Info = await admin2.enableApp({ installed_app_id });
  t.deepEqual(activeApp2Info.app.status, { running: null });
  t.equal(activeApp2Info.app.cell_data[0].role_id, role);
  t.equal(activeApp2Info.app.installed_app_id, installed_app_id);
  t.equal(activeApp2Info.errors.length, 0);

  await delay(500);
  // observe 2 agent infos
  conductor2_agentInfo = await admin2.requestAgentInfo({ cell_id: null });
  t.equal(conductor2_agentInfo.length, 2);

  // now confirm that we can ask for just one cell
  await admin1.addAgentInfo({ agent_infos: conductor2_agentInfo });
  const app1_agentInfo = await admin1.requestAgentInfo({
    cell_id: app1_cell,
  });
  t.equal(app1_agentInfo.length, 1);
  const app2_agentInfo = await admin2.requestAgentInfo({
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

test.skip(
  "can create a callable clone cell",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, role_id, client } = await installAppAndDna(
      ADMIN_PORT
    );
    const info = await client.appInfo({ installed_app_id });

    const createCloneCellParams: CreateCloneCellRequest = {
      app_id: installed_app_id,
      role_id,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await client.createCloneCell(createCloneCellParams);

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
    const response = await client.callZome(params);
    t.equal(
      response,
      "foo",
      "clone cell can be called with same zome call as base cell"
    );
  })
);

test.skip(
  "can archive a clone cell",
  withConductor(ADMIN_PORT, async (t: Test) => {
    const { installed_app_id, role_id, client } = await installAppAndDna(
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

    const appInfo = await client.appInfo({ installed_app_id });
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
      await client.callZome(params);
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
