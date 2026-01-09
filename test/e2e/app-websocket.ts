import assert from "node:assert";
import test from "tape";
import {
  AdminWebsocket,
  AppEntryDef,
  AppWebsocket,
  CallZomeRequest,
  CellType,
  CloneIdHelper,
  CreateCloneCellRequest,
  fakeAgentPubKey,
  GrantZomeCallCapabilityRequest,
  ListCapabilityGrantsRequest,
  RevokeZomeCallCapabilityRequest,
  RoleName,
  RoleNameCallZomeRequest,
  SignalCb,
  SignalType,
} from "../../src";
import {
  createAppWsAndInstallApp,
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
      client: appWs,
      admin,
    } = await createAppWsAndInstallApp(ADMIN_PORT);

    let info = await appWs.appInfo();
    assert(info.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    t.deepEqual(info.cell_info[ROLE_NAME][0].value.cell_id, cell_id);
    t.ok(ROLE_NAME in info.cell_info);
    t.deepEqual(info.status, { type: "enabled" });

    await admin.authorizeSigningCredentials(cell_id);

    const appEntryDef: AppEntryDef = {
      entry_index: 0,
      zome_index: 0,
      visibility: "Private",
    };

    const response = await appWs.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "echo_app_entry_def",
      payload: appEntryDef,
    });

    t.equal(response, null, "app entry type deserializes correctly");

    const cellIdFromRoleName = appWs.getCellIdFromRoleName(ROLE_NAME, info);
    t.deepEqual(cellIdFromRoleName, cell_id);

    const response_from_role_name = await appWs.callZome({
      role_name: ROLE_NAME,
      zome_name: TEST_ZOME_NAME,
      fn_name: "echo_app_entry_def",
      payload: appEntryDef,
    });

    t.equal(
      response_from_role_name,
      null,
      "app entry type deserializes correctly",
    );

    await admin.disableApp({ installed_app_id });
    info = await appWs.appInfo();
    t.deepEqual(info.status, {
      type: "disabled",
      value: { type: "user" },
    });
  }),
);

test(
  "can receive a signal",
  withConductor(ADMIN_PORT, async (t) => {
    let resolveSignalPromise: (value?: unknown) => void | undefined;
    const signalReceivedPromise = new Promise(
      (resolve) => (resolveSignalPromise = resolve),
    );
    const signalCb: SignalCb = (signal) => {
      assert(signal.type === SignalType.App);
      t.deepEqual(signal.value, {
        cell_id,
        zome_name: TEST_ZOME_NAME,
        payload: "i am a signal",
      });
      resolveSignalPromise();
    };

    const {
      admin,
      cell_id,
      client: appWs,
    } = await createAppWsAndInstallApp(ADMIN_PORT);

    await admin.authorizeSigningCredentials(cell_id);

    appWs.on("signal", signalCb);

    // trigger an emit_signal
    await appWs.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "emitter",
      provenance: await fakeAgentPubKey(),
    });
    await signalReceivedPromise;
  }),
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
      source: {
        type: "path",
        value: path,
      },
    });
    assert(app1.cell_info[role_name][0].type === CellType.Provisioned);
    const cell_id1 = app1.cell_info[role_name][0].value.cell_id;
    await admin.enableApp({ installed_app_id: app_id1 });

    let received1 = false;
    const signalCb1: SignalCb = () => {
      received1 = true;
    };

    const app_id2 = "app2";
    const agent2 = await admin.generateAgentPubKey();
    await admin.installApp({
      installed_app_id: app_id2,
      agent_key: agent2,
      source: {
        type: "path",
        value: path,
      },
    });
    await admin.enableApp({ installed_app_id: app_id2 });

    let received2 = false;
    const signalCb2: SignalCb = () => {
      received2 = true;
    };

    await admin.authorizeSigningCredentials(cell_id1);

    const issued1 = await admin.issueAppAuthenticationToken({
      installed_app_id: app_id1,
    });
    const clientUrl = new URL(`ws://localhost:${appPort}`);
    const appWs1 = await AppWebsocket.connect({
      url: clientUrl,
      wsClientOptions: { origin: "client-test-app" },
      token: issued1.token,
    });
    const issued2 = await admin.issueAppAuthenticationToken({
      installed_app_id: app_id2,
    });
    const appWs2 = await AppWebsocket.connect({
      url: clientUrl,
      wsClientOptions: { origin: "client-test-app" },
      token: issued2.token,
    });

    appWs1.on("signal", signalCb1);
    appWs2.on("signal", signalCb2);

    // trigger an emit_signal
    await appWs1.callZome({
      cell_id: cell_id1,
      zome_name: TEST_ZOME_NAME,
      fn_name: "emitter",
      provenance: await fakeAgentPubKey(),
    });

    // signals are received before the timeout step in the JS event loop is completed
    await new Promise((resolve) => setTimeout(resolve, 0));
    t.equal(received1, true);
    t.equal(received2, false);
  }),
);

test(
  "can create a callable clone cell and call it by clone id",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin, client: appWs } = await createAppWsAndInstallApp(ADMIN_PORT);
    const info = await appWs.appInfo();

    const createCloneCellParams: CreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await appWs.createCloneCell(createCloneCellParams);
    await admin.authorizeSigningCredentials(cloneCell.cell_id);

    const expectedCloneId = new CloneIdHelper(ROLE_NAME, 0).toString();
    t.equal(cloneCell.clone_id, expectedCloneId, "correct clone id");
    assert(info.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    t.deepEqual(
      cloneCell.cell_id[1],
      info.cell_info[ROLE_NAME][0].value.cell_id[1],
      "clone cell agent key matches base cell agent key",
    );

    const params: RoleNameCallZomeRequest = {
      role_name: cloneCell.clone_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
    };
    const response = await appWs.callZome(params);
    t.equal(
      response,
      "foo",
      "clone cell can be called with same zome call as base cell, and by clone id",
    );
  }),
);

test(
  "can disable and re-enable a clone cell",
  withConductor(ADMIN_PORT, async (t) => {
    const { admin, client: appWs } = await createAppWsAndInstallApp(ADMIN_PORT);

    const createCloneCellParams: CreateCloneCellRequest = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await appWs.createCloneCell(createCloneCellParams);
    await admin.authorizeSigningCredentials(cloneCell.cell_id);

    await appWs.disableCloneCell({
      clone_cell_id: { type: "dna_hash", value: cloneCell.cell_id[0] },
    });

    const appInfo = await appWs.appInfo();
    t.equal(
      appInfo.cell_info[ROLE_NAME].length,
      2,
      "disabled clone cell is part of app info",
    );
    const params: CallZomeRequest = {
      cell_id: cloneCell.cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
    };
    try {
      await appWs.callZome(params);
      t.fail();
    } catch {
      t.pass("disabled clone call cannot be called");
    }

    await appWs.enableCloneCell({
      clone_cell_id: { type: "dna_hash", value: cloneCell.cell_id[0] },
    });
    await appWs.callZome(params);
    t.pass("re-enabled clone can be called");
  }),
);

test(
  "can grant and revoke zome call capabilities",
  withConductor(ADMIN_PORT, async (t) => {
    const {
      admin,
      client: appWs,
      cell_id: cellId,
    } = await createAppWsAndInstallApp(ADMIN_PORT);

    await admin.authorizeSigningCredentials(cellId);
    const info = await appWs.appInfo();

    // grant capability
    const grantRequest: GrantZomeCallCapabilityRequest = {
      cell_id: cellId,
      cap_grant: {
        tag: "test-grant",
        access: {
          type: "unrestricted",
        },
        functions: {
          type: "all",
        },
      },
    };

    const grantedActionHash = await admin.grantZomeCallCapability(grantRequest);

    // list capability grants
    const listRequest: ListCapabilityGrantsRequest = {
      installed_app_id: info.installed_app_id,
      include_revoked: true,
    };
    const capabilityGrants = await admin.listCapabilityGrants(listRequest);
    // should have 1 item
    t.equal(
      capabilityGrants.length,
      1,
      "should have one capability grant after granting",
    );
    const [cellIdFromGrants, grants] = capabilityGrants[0];
    t.deepEqual(cellIdFromGrants, cellId, "cell id matches");
    t.assert(grants.length > 0, "should have at least one grant");
    const capGrantInfo = grants[grants.length - 1];
    t.equal(capGrantInfo.cap_grant.tag, "test-grant", "grant tag matches");
    t.equal(
      capGrantInfo.cap_grant.functions.type,
      "all",
      "grant functions type matches",
    );
    t.deepEqual(
      capGrantInfo.action_hash,
      grantedActionHash,
      "action hash matches",
    );

    // revoke capability
    const revokeRequest: RevokeZomeCallCapabilityRequest = {
      action_hash: grantedActionHash,
      cell_id: cellId,
    };
    await admin.revokeZomeCallCapability(revokeRequest);

    // list capability grants again
    const capabilityGrantsAfterRevoke =
      await admin.listCapabilityGrants(listRequest);
    // should have 1 item, but the grant should be revoked
    t.equal(
      capabilityGrantsAfterRevoke.length,
      1,
      "should still have one capability grant after revoking",
    );
    // check if has revoked_at
    const [cellIdFromGrantsAfterRevoke] = capabilityGrantsAfterRevoke[0];
    const grantsAfterRevoke = capabilityGrantsAfterRevoke[0][1];
    t.deepEqual(
      cellIdFromGrantsAfterRevoke,
      cellId,
      "cell id matches after revoke",
    );
    t.notEqual(
      grantsAfterRevoke[0].revoked_at,
      undefined,
      "grant should be revoked",
    );
  }),
);

// To test unstable features in Holochain, set env var `TEST_UNSTABLE` to `true`.
if (process.env.TEST_UNSTABLE === "true") {
  test(
    "countersigning session interaction calls",
    withConductor(ADMIN_PORT, async (t) => {
      const { client: appWs, cell_id } =
        await createAppWsAndInstallApp(ADMIN_PORT);

      const response = await appWs.getCountersigningSessionState(cell_id);
      console.log("response", response);
      t.equals(response, null, "countersigning session state should be null");

      try {
        await appWs.abandonCountersigningSession(cell_id);
        t.fail("there should not be a countersigning session to be abandoned");
      } catch (error) {
        assert(error instanceof Error);
        t.assert(
          error.message.includes("SessionNotFound"),
          "there should not be a countersigning session",
        );
      }

      try {
        await appWs.publishCountersigningSession(cell_id);
        t.fail("there should not be a countersigning session to be published");
      } catch (error) {
        assert(error instanceof Error);
        t.assert(
          error.message.includes("SessionNotFound"),
          "there should not be a countersigning session",
        );
      }
    }),
  );
}
